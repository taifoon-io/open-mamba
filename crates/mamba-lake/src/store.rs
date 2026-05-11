use crate::schema::INIT_SQL;
use anyhow::Result;
use duckdb::Connection;
use mamba_types::{
    billing::BillingRecord,
    chain::ChainLog,
    envelope::{TaskEnvelope, TaskStatus},
};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::{Arc, Mutex};
use tracing::info;
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverOutcomeRow {
    pub ts: String,
    pub intent_id: String,
    pub protocol: String,
    pub src_chain: u64,
    pub dst_chain: u64,
    pub decision: String,
    pub tx_hash: Option<String>,
    pub predicted_gas: Option<u64>,
    pub actual_gas: Option<u64>,
    pub effective_gas_price_wei: Option<String>,
    pub predicted_profit_usd: Option<f64>,
    pub actual_profit_usd: Option<f64>,
    pub skip_reason: Option<String>,
    pub error: Option<String>,
}

fn map_outcome_row(r: &duckdb::Row) -> duckdb::Result<SolverOutcomeRow> {
    Ok(SolverOutcomeRow {
        ts:                       r.get(0)?,
        intent_id:                r.get(1)?,
        protocol:                 r.get(2)?,
        src_chain:                r.get(3)?,
        dst_chain:                r.get(4)?,
        decision:                 r.get(5)?,
        tx_hash:                  r.get(6)?,
        predicted_gas:            r.get(7)?,
        actual_gas:               r.get(8)?,
        effective_gas_price_wei:  r.get(9)?,
        predicted_profit_usd:     r.get(10)?,
        actual_profit_usd:        r.get(11)?,
        skip_reason:              r.get(12)?,
        error:                    r.get(13)?,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SolverSkipRuleRow {
    pub id: String,
    pub protocol: String,
    pub rule_json: String,
    pub description: Option<String>,
    pub confidence: f64,
    pub sample_size: u64,
    pub active: bool,
    pub created_at: String,
    pub superseded_at: Option<String>,
}

fn map_skip_rule_row(r: &duckdb::Row) -> duckdb::Result<SolverSkipRuleRow> {
    Ok(SolverSkipRuleRow {
        id:            r.get(0)?,
        protocol:      r.get(1)?,
        rule_json:     r.get(2)?,
        description:   r.get(3)?,
        confidence:    r.get(4)?,
        sample_size:   r.get(5)?,
        active:        r.get(6)?,
        created_at:    r.get(7)?,
        superseded_at: r.get(8)?,
    })
}

#[derive(Debug, Serialize)]
pub struct TaskRow {
    pub id: String,
    pub project: String,
    pub source: String,
    pub assigned_agent: String,
    pub skill: Option<String>,
    pub model: String,
    pub payload: String,
    pub priority: i8,
    pub status: String,
    pub tokens_in: Option<i64>,
    pub tokens_out: Option<i64>,
    pub cost_usd: Option<f64>,
    pub created_at: String,
    pub dispatched_at: Option<String>,
    pub completed_at: Option<String>,
    pub response: Option<String>,
}

fn map_task_row(r: &duckdb::Row) -> duckdb::Result<TaskRow> {
    Ok(TaskRow {
        id:             r.get(0)?,
        project:        r.get(1)?,
        source:         r.get(2)?,
        assigned_agent: r.get(3)?,
        skill:          r.get(4)?,
        model:          r.get(5)?,
        payload:        r.get(6)?,
        priority:       r.get(7)?,
        status:         r.get(8)?,
        tokens_in:      r.get(9)?,
        tokens_out:     r.get(10)?,
        cost_usd:       r.get(11)?,
        created_at:     r.get(12)?,
        dispatched_at:  r.get(13)?,
        completed_at:   r.get(14)?,
        response:       r.get(15).ok(),
    })
}

/// Migrate the `schedules` table to remove the PRIMARY KEY + idx_schedules_due
/// that trigger DuckDB 1.1's fatal RemoveFromIndexes on any UPDATE to indexed
/// columns. Called once at startup, before purge_corrupted_rows.
fn migrate_schedules_remove_pk(conn: &Connection) {
    // Detect PK via duckdb_constraints() — more reliable than information_schema
    // on DuckDB 1.1. Returns > 0 if a PRIMARY KEY constraint exists on `schedules`.
    let has_pk: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0
             FROM duckdb_constraints()
             WHERE table_name = 'schedules'
               AND constraint_type = 'PRIMARY KEY'",
            [],
            |r| r.get(0),
        )
        .unwrap_or(false);
    if !has_pk {
        return;
    }
    tracing::warn!("schedules table has PRIMARY KEY (DuckDB 1.1 crash risk) — migrating");
    let tmp = std::env::temp_dir().join("mamba_schedules_migration.parquet");
    let tmp_str = tmp.to_string_lossy();
    let export_sql = format!(
        "COPY (SELECT * FROM schedules) TO '{tmp_str}' (FORMAT PARQUET);"
    );
    if let Err(e) = conn.execute_batch(&export_sql) {
        tracing::error!("schedules migration: COPY TO parquet failed: {e}");
        return;
    }
    if let Err(e) = conn.execute_batch("DROP TABLE schedules;") {
        tracing::error!("schedules migration: DROP TABLE failed: {e}");
        return;
    }
    let recreate = "CREATE TABLE schedules (
        id               VARCHAR     NOT NULL,
        cron_expr        VARCHAR     NOT NULL,
        project          VARCHAR     NOT NULL,
        assigned_agent   VARCHAR     NOT NULL,
        skill            VARCHAR,
        model            VARCHAR     NOT NULL,
        payload          TEXT        NOT NULL,
        priority         TINYINT     NOT NULL DEFAULT 5,
        enabled          BOOLEAN     NOT NULL DEFAULT TRUE,
        next_run_at      TIMESTAMPTZ NOT NULL,
        last_fired_at    TIMESTAMPTZ,
        fire_count       UBIGINT     NOT NULL DEFAULT 0,
        created_at       TIMESTAMPTZ NOT NULL
    );";
    if let Err(e) = conn.execute_batch(recreate) {
        tracing::error!("schedules migration: recreate failed: {e}");
        return;
    }
    let import_sql = format!(
        "INSERT INTO schedules SELECT * FROM read_parquet('{tmp_str}');"
    );
    let result = conn.execute_batch(&import_sql);
    let _ = std::fs::remove_file(&tmp);
    if let Err(e) = result {
        tracing::error!("schedules migration: re-import failed: {e}");
    } else {
        tracing::warn!("schedules migration complete — PRIMARY KEY removed, all rows preserved");
    }
}

/// Purge rows with NULL priority — these are half-written crash artifacts that
/// corrupt the DuckDB 1.1 PK index. Uses CHECKPOINT + VACUUM to rebuild the
/// index after removal. Called once at startup before any write operations.
fn purge_corrupted_rows(conn: &Connection) {
    // Two classes of corruption we need to handle at startup:
    //   1. Rows with NULL priority (half-written, always broken)
    //   2. Rows stuck `running` for >2 hours that survived previous restarts —
    //      these have a corrupted PK index entry; DELETE on them triggers a
    //      DuckDB 1.1 fatal `RemoveFromIndexes` assertion that invalidates the
    //      whole connection. We must rebuild the table before any reaper runs.
    // Compute cutoff in Rust to avoid DuckDB interval syntax differences.
    let cutoff = (chrono::Utc::now() - chrono::Duration::hours(2)).to_rfc3339();
    let n: i64 = conn
        .query_row(
            "SELECT COUNT(*) FROM task_envelopes \
             WHERE priority IS NULL \
                OR (status='running' AND dispatched_at IS NOT NULL \
                    AND CAST(dispatched_at AS VARCHAR) < ?)",
            duckdb::params![&cutoff],
            |r| r.get(0),
        )
        .unwrap_or(0);
    if n == 0 {
        return;
    }
    tracing::warn!(count = n, "purging {n} corrupted/expired task_envelopes rows");
    // DELETE FROM hits the corrupted PK index and triggers a DuckDB fatal.
    // Instead: export only the truly-good rows (pending/done/failed with
    // priority NOT NULL and not zombie running) to parquet, DROP TABLE to
    // wipe the broken index, recreate, and reload.
    let tmp = std::env::temp_dir().join("mamba_te_recovery.parquet");
    let tmp_str = tmp.to_string_lossy();
    // Preserve: rows that are NOT the problem cases.
    let export_sql = format!(
        "COPY (SELECT * FROM task_envelopes \
               WHERE priority IS NOT NULL \
                 AND NOT (status='running' AND dispatched_at IS NOT NULL \
                          AND CAST(dispatched_at AS VARCHAR) < '{cutoff}') \
        ) TO '{tmp_str}' (FORMAT PARQUET);"
    );
    if let Err(e) = conn.execute_batch(&export_sql) {
        tracing::error!("purge: COPY TO parquet failed: {e}");
        return;
    }
    if let Err(e) = conn.execute_batch("DROP TABLE IF EXISTS task_envelopes;") {
        tracing::error!("purge: DROP TABLE failed: {e}");
        return;
    }
    let recreate = crate::schema::task_envelopes_create_sql();
    if let Err(e) = conn.execute_batch(recreate) {
        tracing::error!("purge: recreate task_envelopes failed: {e}");
        return;
    }
    let import_sql = format!(
        "INSERT INTO task_envelopes SELECT * FROM read_parquet('{tmp_str}');"
    );
    let result = conn.execute_batch(&import_sql);
    let _ = std::fs::remove_file(&tmp);
    if let Err(e) = result {
        tracing::error!("purge: re-import from parquet failed: {e}");
    } else {
        tracing::warn!("purge complete — {n} corrupted/expired row(s) removed, good rows restored");
    }
}

/// Thread-safe DuckDB data lake.
/// Uses blocking Mutex: DuckDB Connection is not Send+Sync natively.
#[derive(Clone)]
pub struct Lake {
    pub(crate) conn: Arc<Mutex<Connection>>,
    db_path: Option<std::path::PathBuf>,
}

impl Lake {
    pub fn open(path: impl AsRef<Path>) -> Result<Self> {
        let path = path.as_ref();
        let conn = Connection::open(path)?;
        conn.execute_batch(INIT_SQL)?;
        // Migrate schedules table: remove PRIMARY KEY + index before any writes.
        // Must run before purge_corrupted_rows so the UPDATE path is safe.
        migrate_schedules_remove_pk(&conn);
        // Remove any rows with NULL priority — these are half-written rows from
        // DuckDB 1.1 crashes that corrupt the PK index and cannot be UPDATEd or
        // DELETEd normally. We must forcibly purge them at startup before any
        // write operations touch them.
        purge_corrupted_rows(&conn);
        info!("DuckDB lake initialized");
        Ok(Self { conn: Arc::new(Mutex::new(conn)), db_path: Some(path.to_path_buf()) })
    }

    pub fn open_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(INIT_SQL)?;
        Ok(Self { conn: Arc::new(Mutex::new(conn)), db_path: None })
    }

    // DuckDB 1.1 single-writer: only the shared connection can write.
    // fresh_conn() would return an error (locked) — use shared_conn() instead
    // for all writes, routing through DELETE+INSERT to avoid the UPDATE/PK bug.
    fn fresh_conn(&self) -> Result<std::sync::MutexGuard<'_, Connection>> {
        Ok(self.conn.lock().unwrap())
    }

    // ── Envelope ops ──────────────────────────────────────────────────────────

    pub fn insert_envelope(&self, e: &TaskEnvelope) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        // Named columns (not VALUES with positional placeholders) so we can
        // add columns to task_envelopes without breaking inserts.
        conn.execute(
            "INSERT INTO task_envelopes
                (id, project, source, assigned_agent, skill, model, payload,
                 priority, status, openfang_job_id, tokens_in, tokens_out,
                 cost_usd, encrypted_payload, chain_tx, created_at,
                 dispatched_at, completed_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            duckdb::params![
                e.id.to_string(),
                e.project,
                e.source.as_str(),
                e.assigned_agent,
                e.skill,
                e.model,
                e.payload,
                e.priority,
                e.status.as_str(),
                e.openfang_job_id.map(|u| u.to_string()),
                e.tokens_in,
                e.tokens_out,
                e.cost_usd,
                e.encrypted_payload,
                e.chain_tx,
                e.created_at.to_rfc3339(),
                e.dispatched_at.map(|t| t.to_rfc3339()),
                e.completed_at.map(|t| t.to_rfc3339()),
            ],
        )?;
        Ok(())
    }

    pub fn update_status(&self, id: Uuid, status: TaskStatus, openfang_job_id: Option<Uuid>) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE task_envelopes SET status=?, openfang_job_id=?, dispatched_at=now()
             WHERE id=?",
            duckdb::params![
                status.as_str(),
                openfang_job_id.map(|u| u.to_string()),
                id.to_string(),
            ],
        )?;
        Ok(())
    }

    pub fn complete_envelope(
        &self,
        id: Uuid,
        tokens_in: i64,
        tokens_out: i64,
        cost_usd: f64,
        chain_tx: Option<&str>,
    ) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE task_envelopes
             SET status='done', tokens_in=?, tokens_out=?, cost_usd=?,
                 chain_tx=?, completed_at=now()
             WHERE id=?",
            duckdb::params![tokens_in, tokens_out, cost_usd, chain_tx, id.to_string()],
        )?;
        Ok(())
    }

    /// Persist the agent's response text. Called separately from
    /// `complete_envelope` so existing call sites don't need to thread
    /// the response through.
    pub fn save_response(&self, id: Uuid, response: &str) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE task_envelopes SET response=? WHERE id=?",
            duckdb::params![response, id.to_string()],
        )?;
        Ok(())
    }

    /// Fetch the response text written by the agent (or None if the task
    /// hasn't completed or the response wasn't captured).
    pub fn get_response(&self, id: Uuid) -> Result<Option<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT response FROM task_envelopes WHERE id=?")?;
        let row = stmt
            .query_map(duckdb::params![id.to_string()], |r| r.get::<_, Option<String>>(0))?
            .filter_map(Result::ok)
            .next()
            .flatten();
        Ok(row)
    }

    pub fn query_tasks(
        &self,
        project: Option<&str>,
        status: Option<&str>,
        limit: i64,
    ) -> Result<Vec<TaskRow>> {
        let conn = self.conn.lock().unwrap();
        let mut sql = String::from(
            "SELECT CAST(id AS VARCHAR), project, source, assigned_agent, skill, model, payload,
                    priority, status, tokens_in, tokens_out, cost_usd,
                    CAST(created_at AS VARCHAR), CAST(dispatched_at AS VARCHAR), CAST(completed_at AS VARCHAR),
                    response
             FROM task_envelopes"
        );
        let mut clauses: Vec<String> = Vec::new();
        if let Some(p) = project { clauses.push(format!("project='{}'", p.replace('\'', "''"))); }
        if let Some(s) = status  { clauses.push(format!("status='{}'",  s.replace('\'', "''"))); }
        if !clauses.is_empty() { sql.push_str(" WHERE "); sql.push_str(&clauses.join(" AND ")); }
        sql.push_str(&format!(" ORDER BY created_at DESC LIMIT {limit}"));
        let mut stmt = conn.prepare(&sql)?;
        let rows: Vec<TaskRow> = stmt
            .query_map([], map_task_row)?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    }

    pub fn debug_count_all(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let n = conn.query_row("SELECT COUNT(*) FROM task_envelopes", [], |r: &duckdb::Row| r.get(0))?;
        Ok(n)
    }

    pub fn debug_status_counts(&self) -> Result<Vec<String>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare("SELECT status, COUNT(*) FROM task_envelopes GROUP BY status")?;
        let rows = stmt.query_map([], |r: &duckdb::Row| {
            let s: String = r.get(0)?;
            let c: i64 = r.get(1)?;
            Ok(format!("{s}={c}"))
        })?.filter_map(Result::ok).collect();
        Ok(rows)
    }

    pub fn get_task(&self, id: Uuid) -> Result<Option<TaskRow>> {
        let conn = self.conn.lock().unwrap();
        let sql = format!(
            "SELECT CAST(id AS VARCHAR), project, source, assigned_agent, skill, model, payload,
                    priority, status, tokens_in, tokens_out, cost_usd,
                    CAST(created_at AS VARCHAR), CAST(dispatched_at AS VARCHAR), CAST(completed_at AS VARCHAR),
                    response
             FROM task_envelopes WHERE id='{}'",
            id
        );
        let mut stmt = conn.prepare(&sql)?;
        let row = stmt
            .query_map([], map_task_row)?
            .filter_map(Result::ok)
            .next();
        Ok(row)
    }

    /// Bulk-reset task rows back to `pending` so the worker re-dispatches
    /// them. Uses DELETE+INSERT to avoid a DuckDB 1.1 bug where UPDATE on
    /// UUID PRIMARY KEY tables triggers an internal assertion in RemoveFromIndexes.
    pub fn reset_to_pending(&self, ids: &[Uuid]) -> Result<usize> {
        if ids.is_empty() {
            return Ok(0);
        }
        let conn = self.fresh_conn()?;
        let mut updated = 0usize;
        for id in ids {
            let id_s = id.to_string();
            // Read only the core columns that `insert_envelope` always wrote.
            // Avoids failures on newer nullable columns (response, retry_count, etc.)
            // that may not exist in older DB files.
            type CoreRow = (String,String,String,String,Option<String>,String,String,i32,String);
            let row_result: duckdb::Result<CoreRow> = conn.query_row(
                "SELECT id,project,source,assigned_agent,skill,model,payload,
                        CAST(priority AS INTEGER),
                        CAST(created_at AS VARCHAR)
                 FROM task_envelopes WHERE id=?",
                duckdb::params![&id_s],
                |r| Ok((
                    r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,
                    r.get(4)?,r.get(5)?,r.get(6)?,r.get(7)?,r.get(8)?,
                )),
            );
            if let Err(ref e) = row_result {
                tracing::warn!(id = %id_s, "reset_to_pending: query_row failed: {e}");
            }
            let Some((rid,project,source,agent,skill,model,payload,priority,created)) = row_result.ok() else {
                continue;
            };
            conn.execute("DELETE FROM task_envelopes WHERE id=?", duckdb::params![&id_s])?;
            conn.execute(
                "INSERT INTO task_envelopes
                    (id,project,source,assigned_agent,skill,model,payload,priority,
                     status,created_at,dispatched_at,completed_at)
                 VALUES (?,?,?,?,?,?,?,?,'pending',?,NULL,NULL)",
                duckdb::params![rid,project,source,agent,skill,model,payload,priority,created],
            )?;
            updated += 1;
        }
        Ok(updated)
    }

    /// Reset every non-completed task to pending. Useful after a server
    /// restart when tasks may have been mid-flight.
    pub fn reset_stuck_tasks(&self) -> Result<usize> {
        let conn = self.fresh_conn()?;
        // Collect stuck IDs first, then reset each via DELETE+INSERT.
        let mut stmt = conn.prepare(
            "SELECT id FROM task_envelopes WHERE status IN ('dispatched','running','failed')"
        )?;
        let ids: Vec<Uuid> = stmt
            .query_map([], |r| r.get::<_, String>(0))?
            .filter_map(Result::ok)
            .filter_map(|s| Uuid::parse_str(&s).ok())
            .collect();
        self.reset_to_pending(&ids)
    }

    /// Mark a task permanently failed via DELETE+INSERT (avoids DuckDB 1.1 UPDATE bug).
    pub fn mark_failed(&self, id: Uuid) -> Result<()> {
        self.set_status_delete_insert(id, "failed", None, None, false)
    }

    /// Set a task's status via DELETE+INSERT using only core columns.
    /// Avoids DuckDB 1.1 UPDATE/PK assertion bug and fragile column-count issues.
    fn set_status_delete_insert(
        &self,
        id: Uuid,
        new_status: &str,
        not_before: Option<chrono::DateTime<chrono::Utc>>,
        retry_bump: Option<i32>,
        _clear_dispatch: bool,
    ) -> Result<()> {
        let id_s = id.to_string();
        let conn = self.fresh_conn()?;
        type CoreRow = (String,String,String,String,Option<String>,String,String,i32,String);
        let row: Option<CoreRow> = conn.query_row(
            "SELECT id,project,source,assigned_agent,skill,model,payload,
                    CAST(priority AS INTEGER),
                    CAST(created_at AS VARCHAR)
             FROM task_envelopes WHERE id=?",
            duckdb::params![&id_s],
            |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?,r.get(7)?,r.get(8)?)),
        ).ok();
        let Some((rid,project,source,agent,skill,model,payload,priority,created)) = row else {
            return Ok(());
        };
        let retry: i32 = retry_bump.unwrap_or_else(|| {
            conn.query_row("SELECT COALESCE(retry_count,0) FROM task_envelopes WHERE id=?",
                duckdb::params![&id_s], |r| r.get(0)).unwrap_or(0)
        });
        let nb = not_before.map(|dt| dt.to_rfc3339());
        tracing::debug!(id=%id_s, status=%new_status, "set_status_delete_insert: about to DELETE");
        conn.execute("DELETE FROM task_envelopes WHERE id=?", duckdb::params![&id_s])?;
        tracing::debug!(id=%id_s, "set_status_delete_insert: DELETE done, inserting");
        conn.execute(
            "INSERT INTO task_envelopes
                (id,project,source,assigned_agent,skill,model,payload,priority,
                 status,created_at,dispatched_at,completed_at,retry_count,not_before)
             VALUES (?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,?)",
            duckdb::params![rid,project,source,agent,skill,model,payload,priority,
                            new_status,created,retry,nb],
        )?;
        Ok(())
    }

    /// Decide whether a dispatch failure should be retried.
    // NOTE: Must NOT call set_status_delete_insert/mark_failed here — those acquire
    // fresh_conn() themselves, causing a mutex deadlock (std::sync::Mutex is not reentrant).
    // Instead we hold the lock for the full operation and do everything inline.
    pub fn record_dispatch_failure(
        &self,
        id: Uuid,
        is_transient: bool,
        max_retries: i32,
        backoff_secs: i64,
    ) -> Result<bool> {
        let id_s = id.to_string();
        let conn = self.conn.lock().unwrap();

        let current_retry: i32 = conn
            .query_row(
                "SELECT COALESCE(retry_count, 0) FROM task_envelopes WHERE id=?",
                duckdb::params![&id_s],
                |r| r.get(0),
            )
            .unwrap_or(0);

        if is_transient && current_retry < max_retries {
            let next_pickup = chrono::Utc::now() + chrono::Duration::seconds(backoff_secs);
            let nb = next_pickup.to_rfc3339();
            // Fetch core columns so we can DELETE+INSERT (UPDATE also triggers DuckDB 1.1 index bug
            // if any index exists; DELETE+INSERT is the safe path).
            type CoreRow = (String,String,String,String,Option<String>,String,String,i32,String);
            let row: Option<CoreRow> = conn.query_row(
                "SELECT id,project,source,assigned_agent,skill,model,payload,
                        CAST(priority AS INTEGER),
                        CAST(created_at AS VARCHAR)
                 FROM task_envelopes WHERE id=?",
                duckdb::params![&id_s],
                |r| Ok((r.get(0)?,r.get(1)?,r.get(2)?,r.get(3)?,r.get(4)?,r.get(5)?,r.get(6)?,r.get(7)?,r.get(8)?)),
            ).ok();
            let Some((rid,project,source,agent,skill,model,payload,priority,created)) = row else {
                return Ok(false);
            };
            let next_retry = current_retry + 1;
            conn.execute("DELETE FROM task_envelopes WHERE id=?", duckdb::params![&id_s])?;
            conn.execute(
                "INSERT INTO task_envelopes
                    (id,project,source,assigned_agent,skill,model,payload,priority,
                     status,created_at,dispatched_at,completed_at,retry_count,not_before)
                 VALUES (?,?,?,?,?,?,?,?,?,?,NULL,NULL,?,?)",
                duckdb::params![rid,project,source,agent,skill,model,payload,priority,
                                "pending",created,next_retry,nb],
            )?;
            Ok(true)
        } else {
            // Permanent failure: use UPDATE since there are no indexes on task_envelopes
            // (indexes were dropped to fix DuckDB 1.1 RemoveFromIndexes fatal bug).
            conn.execute(
                "UPDATE task_envelopes SET status='failed' WHERE id=?",
                duckdb::params![&id_s],
            )?;
            Ok(false)
        }
    }

    /// Force-fail tasks that have been `running` longer than `timeout_secs`.
    /// Returns the number of tasks reaped.
    pub fn reap_stuck_tasks(&self, timeout_secs: i64) -> Result<usize> {
        let conn = self.fresh_conn()?;
        let cutoff = chrono::Utc::now() - chrono::Duration::seconds(timeout_secs);
        let mut stmt = conn.prepare(
            "SELECT id FROM task_envelopes
             WHERE status='running'
               AND dispatched_at IS NOT NULL
               AND dispatched_at < ?",
        )?;
        let ids: Vec<Uuid> = stmt
            .query_map(duckdb::params![cutoff.to_rfc3339()], |r| r.get::<_, String>(0))?
            .filter_map(Result::ok)
            .filter_map(|s| Uuid::parse_str(&s).ok())
            .collect();
        let mut n = 0usize;
        for id in ids {
            // Tolerate corrupted rows that can't be deleted (DuckDB index damage).
            if self.mark_failed(id).is_ok() {
                n += 1;
            }
        }
        Ok(n)
    }

    pub fn list_pending(&self) -> Result<Vec<Uuid>> {
        let conn = self.conn.lock().unwrap();
        // Honor `not_before` so backed-off retries don't fire instantly.
        let mut stmt = conn.prepare(
            "SELECT id FROM task_envelopes
             WHERE status='pending'
               AND (not_before IS NULL OR not_before <= now())
             ORDER BY priority ASC, created_at ASC"
        )?;
        let ids = stmt
            .query_map([], |row| row.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .filter_map(|s| Uuid::parse_str(&s).ok())
            .collect();
        Ok(ids)
    }

    // ── Billing ops ───────────────────────────────────────────────────────────

    pub fn insert_billing(&self, b: &BillingRecord) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO billing_records VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            duckdb::params![
                b.id.to_string(),
                b.task_id.to_string(),
                b.project,
                b.agent_slug,
                b.model,
                b.tokens_in,
                b.tokens_out,
                b.cost_usd,
                b.encrypted_log,
                b.chain_tx,
                b.chain_block,
                b.created_at.to_rfc3339(),
            ],
        )?;
        Ok(())
    }

    pub fn update_billing_tx(&self, id: Uuid, tx: &str, block: u64) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE billing_records SET chain_tx=?, chain_block=? WHERE id=?",
            duckdb::params![tx, block, id.to_string()],
        )?;
        Ok(())
    }

    // ── Solver outcome ops ────────────────────────────────────────────────────

    pub fn insert_outcome(&self, o: &SolverOutcomeRow) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO solver_outcomes
                (ts, intent_id, protocol, src_chain, dst_chain, decision, tx_hash,
                 predicted_gas, actual_gas, effective_gas_price_wei,
                 predicted_profit_usd, actual_profit_usd, skip_reason, error)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            duckdb::params![
                o.ts.clone(),
                o.intent_id,
                o.protocol,
                o.src_chain,
                o.dst_chain,
                o.decision,
                o.tx_hash,
                o.predicted_gas,
                o.actual_gas,
                o.effective_gas_price_wei,
                o.predicted_profit_usd,
                o.actual_profit_usd,
                o.skip_reason,
                o.error,
            ],
        )?;
        Ok(())
    }

    pub fn count_outcomes(&self) -> Result<i64> {
        let conn = self.conn.lock().unwrap();
        let n: i64 = conn.query_row("SELECT COUNT(*) FROM solver_outcomes", [], |r| r.get(0))?;
        Ok(n)
    }

    pub fn recent_outcomes(&self, limit: i64) -> Result<Vec<SolverOutcomeRow>> {
        let conn = self.conn.lock().unwrap();
        let sql = format!(
            "SELECT CAST(ts AS VARCHAR), intent_id, protocol, src_chain, dst_chain,
                    decision, tx_hash, predicted_gas, actual_gas, effective_gas_price_wei,
                    predicted_profit_usd, actual_profit_usd, skip_reason, error
             FROM solver_outcomes ORDER BY ts DESC LIMIT {limit}"
        );
        let mut stmt = conn.prepare(&sql)?;
        let rows = stmt
            .query_map([], map_outcome_row)?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    }

    // ── Solver skip-rule ops ──────────────────────────────────────────────────

    pub fn insert_skip_rule(&self, r: &SolverSkipRuleRow) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO solver_skip_rules
                (id, protocol, rule_json, description, confidence, sample_size,
                 active, created_at, superseded_at)
             VALUES (?,?,?,?,?,?,?,?,?)",
            duckdb::params![
                r.id,
                r.protocol,
                r.rule_json,
                r.description,
                r.confidence,
                r.sample_size,
                r.active,
                r.created_at,
                r.superseded_at,
            ],
        )?;
        Ok(())
    }

    pub fn list_active_skip_rules(&self) -> Result<Vec<SolverSkipRuleRow>> {
        let conn = self.conn.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT CAST(id AS VARCHAR), protocol, rule_json, description, confidence,
                    sample_size, active, CAST(created_at AS VARCHAR),
                    CAST(superseded_at AS VARCHAR)
             FROM solver_skip_rules WHERE active=TRUE ORDER BY created_at DESC"
        )?;
        let rows = stmt
            .query_map([], map_skip_rule_row)?
            .filter_map(Result::ok)
            .collect();
        Ok(rows)
    }

    /// Mark all currently-active rules for `protocol` as superseded, then insert
    /// `new_rules`. Used by the weekly nemotron analyzer to publish a fresh set.
    pub fn replace_skip_rules(&self, protocol: &str, new_rules: &[SolverSkipRuleRow]) -> Result<usize> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "UPDATE solver_skip_rules SET active=FALSE, superseded_at=now()
             WHERE protocol=? AND active=TRUE",
            duckdb::params![protocol],
        )?;
        for r in new_rules {
            conn.execute(
                "INSERT INTO solver_skip_rules
                    (id, protocol, rule_json, description, confidence, sample_size,
                     active, created_at, superseded_at)
                 VALUES (?,?,?,?,?,?,?,?,?)",
                duckdb::params![
                    r.id,
                    r.protocol,
                    r.rule_json,
                    r.description,
                    r.confidence,
                    r.sample_size,
                    r.active,
                    r.created_at,
                    r.superseded_at,
                ],
            )?;
        }
        Ok(new_rules.len())
    }

    // ── Chain log ops ─────────────────────────────────────────────────────────

    pub fn insert_chain_log(&self, log: &ChainLog) -> Result<()> {
        let conn = self.conn.lock().unwrap();
        conn.execute(
            "INSERT INTO chain_logs VALUES (?,?,?,?,?,?,?,?,?)",
            duckdb::params![
                log.id.to_string(),
                log.kind.as_str(),
                log.task_id.map(|u| u.to_string()),
                log.payload_hash,
                log.tx_hash,
                log.block_number,
                log.chain_id,
                log.submitted_at.to_rfc3339(),
                log.confirmed_at.map(|t| t.to_rfc3339()),
            ],
        )?;
        Ok(())
    }
}
