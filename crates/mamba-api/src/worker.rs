//! Pending-task worker.
//!
//! Polls the DuckDB lake for `status=pending` tasks and dispatches each
//! through the bus. Replaces openfang's cron scheduler entirely — every
//! task runs exactly once. The bus's own dispatch path (Bus::route) handles
//! the actual nemotron / openfang routing.
//!
//! ## Why not a queue with notify?
//!
//! DuckDB doesn't have LISTEN/NOTIFY, and the volume here is low (tens to
//! hundreds of tasks/hour). A 2s poll loop costs nothing and keeps the
//! design simple — no need for an in-process channel that has to survive
//! a server restart.
//!
//! ## Concurrency
//!
//! Up to `WORKER_CONCURRENCY` envelopes can be in flight at once. Each is
//! dispatched in its own task, so a slow agent turn doesn't block the
//! queue. The bus's `dispatch_openfang` writes `Running → Done|Failed`
//! atomically, so we never re-enter a task that's mid-flight.

use crate::routes::envelope_from_row;
use mamba_bus::Bus;
use mamba_lake::Lake;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, info, warn};

const POLL_INTERVAL: Duration = Duration::from_secs(2);
// Keep concurrency at 2 so long-running agent turns (cargo build, multi-file
// edits) don't saturate the tokio runtime and starve the HTTP handler.
// Each dispatch is awaited on the async runtime; with 4 concurrent 3-5 minute
// cargo jobs the axum handler can't get a thread and /api/tasks times out.
const WORKER_CONCURRENCY: usize = 2;
// Force-fail tasks stuck in `running` after 15 minutes. This catches agents
// that hang on long shell commands (cargo run, timeout 120) without waiting
// the full 70-minute openfang timeout. The reaper runs every 2 minutes so
// the actual latency before a stuck task is cleared is ≤ 2 min + 15 min.
const STUCK_TASK_TIMEOUT_SECS: i64 = 15 * 60;
const REAP_INTERVAL: Duration = Duration::from_secs(2 * 60);

pub fn spawn(lake: Lake, bus: Bus) {
    let in_flight = Arc::new(AtomicUsize::new(0));

    // Reaper: runs every 5 minutes, force-fails tasks stuck > 70 min.
    let reaper_lake = lake.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(REAP_INTERVAL).await;
            match reaper_lake.reap_stuck_tasks(STUCK_TASK_TIMEOUT_SECS) {
                Ok(0) => {}
                Ok(n) => warn!(reaped = n, "worker: force-failed {n} stuck task(s) (>70 min running)"),
                Err(e) => warn!("worker: reap_stuck_tasks failed: {e}"),
            }
        }
    });

    tokio::spawn(async move {
        info!(
            poll_secs = POLL_INTERVAL.as_secs(),
            concurrency = WORKER_CONCURRENCY,
            "queue worker started"
        );
        loop {
            tokio::time::sleep(POLL_INTERVAL).await;

            // Skip the poll if we're already saturated.
            let inflight_now = in_flight.load(Ordering::SeqCst);
            if inflight_now >= WORKER_CONCURRENCY {
                debug!(inflight = inflight_now, "worker saturated, skipping poll");
                continue;
            }

            let pending = match lake.list_pending() {
                Ok(v) => v,
                Err(e) => {
                    warn!("worker: list_pending failed: {e}");
                    continue;
                }
            };
            if pending.is_empty() {
                continue;
            }

            let slots = WORKER_CONCURRENCY - inflight_now;
            for id in pending.into_iter().take(slots) {
                let row = match lake.get_task(id) {
                    Ok(Some(r)) => r,
                    Ok(None) => continue,
                    Err(e) => {
                        warn!(%id, "worker: get_task failed: {e}");
                        continue;
                    }
                };

                // Defensive: another worker might have grabbed it. Re-check
                // status before dispatching. (Single-process today, but cheap.)
                if row.status != "pending" {
                    continue;
                }

                let envelope = match envelope_from_row(&row) {
                    Ok(e) => e,
                    Err(e) => {
                        warn!(%id, "worker: envelope_from_row failed: {e}");
                        continue;
                    }
                };

                let bus = bus.clone();
                let counter = in_flight.clone();
                counter.fetch_add(1, Ordering::SeqCst);
                tokio::spawn(async move {
                    let id_for_log = envelope.id;
                    info!(%id_for_log, agent = %envelope.assigned_agent, "worker: dispatching");
                    // Per-task hard timeout: if the agent turn hasn't finished
                    // in 20 minutes, abandon it. The reaper will mark it failed
                    // on the next 2-minute tick. Without this, a hung openfang
                    // turn holds a concurrency slot indefinitely and the HTTP
                    // handler eventually starves when all slots block on the
                    // same stalled reqwest connection.
                    let result = tokio::time::timeout(
                        Duration::from_secs(20 * 60),
                        bus.route_blocking(envelope),
                    ).await;
                    match result {
                        Ok(Ok(())) => {}
                        Ok(Err(e)) => warn!(%id_for_log, "worker: dispatch failed: {e}"),
                        Err(_) => warn!(%id_for_log, "worker: dispatch timed out after 20 min — slot released, reaper will mark failed"),
                    }
                    counter.fetch_sub(1, Ordering::SeqCst);
                });
            }
        }
    });
}
