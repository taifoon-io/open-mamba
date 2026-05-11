//! Workflow advancer.
//!
//! Polls DuckDB for running workflow runs whose `current_task_id` has
//! status='done' (or 'failed'), then either:
//!   - dispatches the next workflow step (linear chain), OR
//!   - if the finished step was a code-reviewer, parses its verdict:
//!       APPROVED        → advance normally / complete run
//!       CHANGES_REQUESTED → re-dispatch the coder step with reviewer
//!                           feedback injected, up to MAX_FIXUP_ROUNDS
//!       BLOCKED         → fail the run permanently (no retry)
//!   - marks the run completed when no more steps remain, OR
//!   - marks the run failed if the task failed (permanent) or the fixup
//!     budget is exhausted.

use mamba_bus::Bus;
use mamba_lake::{Lake, WorkflowStep};
use mamba_types::envelope::{TaskEnvelope, TaskSource};
use std::time::Duration;
use tracing::{info, warn};

const TICK_INTERVAL: Duration = Duration::from_secs(2);

/// Maximum number of coder→reviewer cycles before giving up.
const MAX_FIXUP_ROUNDS: usize = 3;

pub fn spawn(lake: Lake, bus: Bus) {
    tokio::spawn(async move {
        info!(
            tick_secs = TICK_INTERVAL.as_secs(),
            "workflow advancer started"
        );
        loop {
            tokio::time::sleep(TICK_INTERVAL).await;
            if let Err(e) = tick(&lake, &bus).await {
                warn!("workflow tick failed: {e}");
            }
        }
    });
}

async fn tick(lake: &Lake, bus: &Bus) -> anyhow::Result<()> {
    let runs = lake.list_runs(None, 100)?;
    for run in runs {
        if run.status != "running" {
            continue;
        }
        let Some(task_id) = run.current_task_id else {
            continue;
        };
        let task = match lake.get_task(task_id) {
            Ok(Some(t)) => t,
            _ => continue,
        };
        match task.status.as_str() {
            "done" => {
                if let Err(e) = advance(lake, bus, &run, &task).await {
                    warn!(run_id = %run.run_id, "advance failed: {e}");
                }
            }
            "failed" => {
                let mut failed = run.clone();
                failed.status = "failed".into();
                failed.error = Some(format!("step {} task failed permanently", run.current_step));
                failed.completed_at = Some(chrono::Utc::now());
                failed.current_task_id = None;
                let _ = lake.update_run(&failed);
                warn!(run_id = %run.run_id, step = run.current_step, "workflow: task failed, run aborted");
            }
            _ => {} // pending / running / dispatched — keep waiting
        }
    }
    Ok(())
}

/// Verdict parsed from a code-reviewer response.
#[derive(Debug, PartialEq)]
enum ReviewVerdict {
    Approved,
    ChangesRequested(String), // carries the reviewer feedback
    Blocked(String),          // permanent — carries the reason
    Unknown,                  // no recognised signal — treat as approved
}

fn parse_reviewer_verdict(response: &str) -> ReviewVerdict {
    let upper = response.to_uppercase();
    // BLOCKED takes priority — reviewer says don't retry.
    if upper.contains("BLOCKED") || upper.contains("PERMANENTLY_BLOCKED") {
        return ReviewVerdict::Blocked(response.to_string());
    }
    if upper.contains("CHANGES_REQUESTED") || upper.contains("CHANGES REQUESTED") {
        return ReviewVerdict::ChangesRequested(response.to_string());
    }
    if upper.contains("APPROVED") || upper.contains("LGTM") || upper.contains("CONFIRMED") {
        return ReviewVerdict::Approved;
    }
    ReviewVerdict::Unknown
}

/// Count how many fixup rounds have already been attempted in this run.
/// A fixup round is a coder step that follows a CHANGES_REQUESTED reviewer step.
fn fixup_rounds_used(run: &mamba_lake::WorkflowRun) -> usize {
    run.outputs
        .iter()
        .filter(|o| {
            o.get("verdict")
                .and_then(|v| v.as_str())
                .map(|v| v == "changes_requested")
                .unwrap_or(false)
        })
        .count()
}

async fn advance(
    lake: &Lake,
    bus: &Bus,
    run: &mamba_lake::WorkflowRun,
    finished_task: &mamba_lake::TaskRow,
) -> anyhow::Result<()> {
    let response_text = lake
        .get_response(uuid::Uuid::parse_str(&finished_task.id)?)?
        .unwrap_or_default();

    let is_reviewer = finished_task.assigned_agent == "code-reviewer";

    // If the finished step was the reviewer, parse its verdict before
    // deciding what to do next.
    if is_reviewer {
        let verdict = parse_reviewer_verdict(&response_text);
        info!(
            run_id = %run.run_id,
            step   = run.current_step,
            ?verdict,
            "reviewer verdict"
        );

        match verdict {
            ReviewVerdict::Blocked(reason) => {
                // Permanent — record and stop.
                let mut updated = run.clone();
                updated.outputs.push(serde_json::json!({
                    "step":       run.current_step,
                    "task_id":    finished_task.id,
                    "agent":      "code-reviewer",
                    "verdict":    "blocked",
                    "response":   response_text,
                    "tokens_in":  finished_task.tokens_in,
                    "tokens_out": finished_task.tokens_out,
                    "cost_usd":   finished_task.cost_usd,
                }));
                updated.status = "failed".into();
                updated.error = Some(format!("reviewer blocked: {}", &reason[..reason.len().min(200)]));
                updated.completed_at = Some(chrono::Utc::now());
                updated.current_task_id = None;
                lake.update_run(&updated)?;
                warn!(run_id = %run.run_id, "workflow blocked by reviewer");
                return Ok(());
            }

            ReviewVerdict::ChangesRequested(feedback) => {
                let rounds = fixup_rounds_used(run);
                let mut updated = run.clone();
                updated.outputs.push(serde_json::json!({
                    "step":       run.current_step,
                    "task_id":    finished_task.id,
                    "agent":      "code-reviewer",
                    "verdict":    "changes_requested",
                    "response":   response_text,
                    "tokens_in":  finished_task.tokens_in,
                    "tokens_out": finished_task.tokens_out,
                    "cost_usd":   finished_task.cost_usd,
                }));

                if rounds >= MAX_FIXUP_ROUNDS {
                    updated.status = "failed".into();
                    updated.error = Some(format!(
                        "reviewer requested changes {MAX_FIXUP_ROUNDS}× — giving up"
                    ));
                    updated.completed_at = Some(chrono::Utc::now());
                    updated.current_task_id = None;
                    lake.update_run(&updated)?;
                    warn!(
                        run_id = %run.run_id,
                        rounds,
                        "workflow: fixup budget exhausted, failing run"
                    );
                    return Ok(());
                }

                // Re-dispatch the coder step with the reviewer feedback
                // injected so the agent knows exactly what to fix.
                let workflow = match lake.get_workflow(&run.workflow_id)? {
                    Some(w) => w,
                    None => anyhow::bail!("workflow definition missing"),
                };
                // Coder step is always step 0 in auto-generated workflows.
                let coder_step = &workflow.steps[0];
                let fixup_payload = serde_json::json!({
                    "template":          coder_step.payload,
                    "fixup_round":       rounds + 1,
                    "reviewer_feedback": feedback,
                    "__previous":        updated.outputs.last().cloned().unwrap_or(serde_json::Value::Null),
                    "__workflow": {
                        "run_id":        run.run_id,
                        "workflow_id":   run.workflow_id,
                        "step_name":     "fixup",
                        "initial_input": run.initial_input,
                    },
                });
                let fixup_envelope = TaskEnvelope::new(
                    coder_step.project.clone(),
                    TaskSource::Webhook,
                    coder_step.assigned_agent.clone(),
                    coder_step.skill.clone(),
                    coder_step.model.clone(),
                    fixup_payload.to_string(),
                    coder_step.priority,
                );
                let fixup_id = fixup_envelope.id;
                bus.submit(fixup_envelope).await?;

                // Rewind step counter to 0 (coder) so the reviewer fires again after.
                updated.current_step = 0;
                updated.current_task_id = Some(fixup_id);
                lake.update_run(&updated)?;
                info!(
                    run_id   = %run.run_id,
                    round    = rounds + 1,
                    task_id  = %fixup_id,
                    "workflow: CHANGES_REQUESTED — re-dispatching coder (fixup round {}/{})",
                    rounds + 1, MAX_FIXUP_ROUNDS
                );
                return Ok(());
            }

            // APPROVED, LGTM, CONFIRMED, or unknown signal → fall through to
            // normal linear advance below (which will complete the run since
            // reviewer is the last step).
            ReviewVerdict::Approved | ReviewVerdict::Unknown => {}
        }
    }

    // ── Normal linear advance ─────────────────────────────────────────────────
    let mut updated = run.clone();
    updated.outputs.push(serde_json::json!({
        "step":     run.current_step,
        "task_id":  finished_task.id,
        "agent":    finished_task.assigned_agent,
        "verdict":  if is_reviewer { serde_json::json!("approved") } else { serde_json::Value::Null },
        "response": response_text,
        "tokens_in":  finished_task.tokens_in,
        "tokens_out": finished_task.tokens_out,
        "cost_usd":   finished_task.cost_usd,
    }));

    let workflow = match lake.get_workflow(&run.workflow_id)? {
        Some(w) => w,
        None => {
            updated.status = "failed".into();
            updated.error = Some("workflow definition deleted mid-run".into());
            updated.completed_at = Some(chrono::Utc::now());
            updated.current_task_id = None;
            lake.update_run(&updated)?;
            return Ok(());
        }
    };

    let next_step_idx = (run.current_step + 1) as usize;
    if next_step_idx >= workflow.steps.len() {
        updated.status = "done".into();
        updated.completed_at = Some(chrono::Utc::now());
        updated.current_task_id = None;
        updated.current_step = next_step_idx as i32;
        lake.update_run(&updated)?;
        info!(
            run_id = %run.run_id,
            steps  = workflow.steps.len(),
            "workflow complete"
        );
        return Ok(());
    }

    let next = &workflow.steps[next_step_idx];
    let envelope = build_step_envelope(next, &updated)?;
    let task_id = envelope.id;
    bus.submit(envelope).await?;

    updated.current_step = next_step_idx as i32;
    updated.current_task_id = Some(task_id);
    lake.update_run(&updated)?;
    info!(
        run_id = %run.run_id,
        step   = next_step_idx,
        task_id = %task_id,
        agent  = %next.assigned_agent,
        "workflow advanced"
    );
    Ok(())
}

/// Build the envelope for a single step. Injects the run history as
/// `__workflow` and the most recent output as `__previous` in the
/// payload JSON, so the agent has full context.
pub fn build_step_envelope(
    step: &WorkflowStep,
    run: &mamba_lake::WorkflowRun,
) -> anyhow::Result<TaskEnvelope> {
    let previous = run.outputs.last().cloned().unwrap_or(serde_json::Value::Null);
    let payload = serde_json::json!({
        "template":   step.payload,
        "__previous": previous,
        "__workflow": {
            "run_id":        run.run_id,
            "workflow_id":   run.workflow_id,
            "step_index":    run.current_step + 1,
            "step_name":     step.name,
            "initial_input": run.initial_input,
        },
    });
    Ok(TaskEnvelope::new(
        step.project.clone(),
        TaskSource::Webhook,
        step.assigned_agent.clone(),
        step.skill.clone(),
        step.model.clone(),
        payload.to_string(),
        step.priority,
    ))
}
