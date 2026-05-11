use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    middleware::{self, Next},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Json, Router,
};
use axum::http::Request;
use mamba_bus::Bus;
use mamba_lake::{Lake, SolverOutcomeRow, SolverSkipRuleRow, Workflow, WorkflowRun, WorkflowStep};
use mamba_nemotron::{NemotronAdapter, NemotronClient};
use chrono::Utc;
use mamba_types::envelope::{TaskEnvelope, TaskSource, TaskStatus};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use uuid::Uuid;

/// Bearer token check for write/expensive endpoints.
///
/// Reads `MAMBA_API_KEY` from the environment at request time. When unset
/// (the default), the middleware is a no-op — useful for local dev. When
/// set, every request must carry `authorization: Bearer <key>` or
/// `x-mamba-key: <key>` and the value must match.
///
/// Designed for the public-deploy scenario: anyone running the bus on the
/// open internet should set MAMBA_API_KEY so random callers can't burn
/// their nemotron / claude budget.
/// Constant-time string comparison. No timing side-channel via early-exit.
/// Length leak is acceptable here — keys we compare against are fixed-length.
fn ct_eq(a: &str, b: &str) -> bool {
    let a = a.as_bytes();
    let b = b.as_bytes();
    if a.len() != b.len() { return false; }
    let mut diff = 0u8;
    for i in 0..a.len() { diff |= a[i] ^ b[i]; }
    diff == 0
}

/// Pull `x-grid-key` from a request and report whether it matches `TAIFOON_GRID_KEY`.
/// Returns:
///   `(env_set, signed_in)`
/// `env_set = false` ⇒ open mode (no auth required, local-dev default).
/// `env_set = true && signed_in = true` ⇒ valid grid key on the request.
/// `env_set = true && signed_in = false` ⇒ guarded but unauthed.
fn grid_state(headers: &axum::http::HeaderMap) -> (bool, bool) {
    let env  = std::env::var("TAIFOON_GRID_KEY").ok().filter(|v| !v.is_empty());
    let env_set = env.is_some();
    let provided = headers.get("x-grid-key").and_then(|v| v.to_str().ok());
    let signed_in = match (env, provided) {
        (Some(expected), Some(provided)) => ct_eq(&expected, provided),
        _ => false,
    };
    (env_set, signed_in)
}

/// Bearer-style auth for routes that always cost money (nemotron generate,
/// task retry, workflow execution). Accepts EITHER:
///   - `MAMBA_API_KEY` env via `authorization: Bearer …` or `x-mamba-key: …`
///   - `TAIFOON_GRID_KEY` env via `x-grid-key: …`
async fn require_api_key(
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let mamba_key = std::env::var("MAMBA_API_KEY").ok().filter(|v| !v.is_empty());
    let grid_key  = std::env::var("TAIFOON_GRID_KEY").ok().filter(|v| !v.is_empty());

    // Open mode — neither key configured. Useful for local dev.
    if mamba_key.is_none() && grid_key.is_none() {
        return Ok(next.run(req).await);
    }

    let h = req.headers();
    let bearer = h
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.strip_prefix("Bearer "));
    let mamba_provided = h.get("x-mamba-key").and_then(|v| v.to_str().ok()).or(bearer);
    let grid_provided  = h.get("x-grid-key").and_then(|v| v.to_str().ok());

    let mamba_match = matches!(
        (&mamba_key, mamba_provided),
        (Some(expected), Some(provided)) if ct_eq(expected, provided)
    );
    let grid_match = matches!(
        (&grid_key, grid_provided),
        (Some(expected), Some(provided)) if ct_eq(expected, provided)
    );

    if mamba_match || grid_match {
        Ok(next.run(req).await)
    } else {
        Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "missing or invalid api key",
                "hint":  "send `x-grid-key: <taifoon grid key>`, `x-mamba-key: <mamba api key>`, or `authorization: Bearer <mamba api key>`"
            })),
        ))
    }
}

/// Selective gate for `/ingest`. The base bus is open as usual — local Claude
/// tasks, BYO inference, anything you'd want to try on a laptop. Only when a
/// task asks for a `nemotron/*` model (which routes through Taifoon's GPU
/// fleet by default) do we require a grid key.
///
/// Behavior:
///   - `TAIFOON_GRID_KEY` unset ⇒ open mode, every model accepted.
///   - `TAIFOON_GRID_KEY` set, model is non-nemotron ⇒ accepted (Claude etc.).
///   - `TAIFOON_GRID_KEY` set, model starts with `nemotron/`, no/invalid key ⇒ 401.
async fn require_grid_for_nemotron(
    req: Request<axum::body::Body>,
    next: Next,
) -> Result<Response, (StatusCode, Json<serde_json::Value>)> {
    let env_set = std::env::var("TAIFOON_GRID_KEY").ok()
        .filter(|v| !v.is_empty()).is_some();

    // Open mode — let everything through.
    if !env_set { return Ok(next.run(req).await); }

    // Sniff the body to find out which model the task is asking for. We read,
    // peek at JSON, then put the body back so the actual handler still works.
    let (parts, body) = req.into_parts();
    let bytes = axum::body::to_bytes(body, 1024 * 1024)
        .await
        .map_err(|_| (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "body too large" }))))?;

    let model_field = serde_json::from_slice::<serde_json::Value>(&bytes)
        .ok()
        .and_then(|v| v.get("model").and_then(|m| m.as_str()).map(|s| s.to_string()))
        .unwrap_or_default();

    let req = Request::from_parts(parts, axum::body::Body::from(bytes));

    // Non-nemotron tasks pass through with no auth, just like before.
    if !model_field.starts_with("nemotron/") {
        return Ok(next.run(req).await);
    }

    // Nemotron-routed task — require a valid x-grid-key.
    let (_, signed_in) = grid_state(req.headers());
    if signed_in {
        Ok(next.run(req).await)
    } else {
        Err((
            StatusCode::UNAUTHORIZED,
            Json(serde_json::json!({
                "error": "nemotron routing requires a valid Taifoon grid key",
                "hint":  "sign in on the dashboard, or send `x-grid-key: <key>` against TAIFOON_GRID_KEY",
                "model": model_field,
            })),
        ))
    }
}

#[derive(Clone)]
pub struct AppState {
    pub lake: Lake,
    pub bus: Bus,
    pub nemotron: Arc<NemotronClient>,
}

pub fn build(lake: Lake, bus: Bus, nemotron: Arc<NemotronClient>) -> Router {
    let state = AppState { lake: lake.clone(), bus, nemotron };

    // ── /ingest is selectively gated: open for non-nemotron tasks (so the
    // basic mamba bus runs as usual on a laptop with no env keys), gated by
    // x-grid-key when the task asks for a `nemotron/*` model.
    let ingest_router = Router::new()
        .route("/ingest", post(ingest_task))
        .route_layer(middleware::from_fn(require_grid_for_nemotron));

    // Protected: spends money / mutates queue. Gated by MAMBA_API_KEY when set.
    let protected = Router::new()
        .route("/api/tasks/:id/retry", post(retry_task))
        .route("/api/tasks/retry-pending", post(retry_pending))
        .route("/api/nemotron/:model/generate", post(nemotron_generate))
        // Publishing skip-rules supersedes the existing rule set — gate it.
        .route("/api/solver/skip-rules", post(publish_skip_rules))
        // Trigger management — anyone with the API key can register webhooks
        // and schedules. The actual fire endpoint (POST /webhooks/:id) is
        // intentionally public so external systems can hit it.
        .route("/api/webhooks", post(crate::triggers::create_webhook))
        .route("/api/webhooks/:hook_id", axum::routing::delete(crate::triggers::delete_webhook))
        .route("/api/schedules", post(crate::triggers::create_schedule))
        .route("/api/schedules/:id", axum::routing::delete(crate::triggers::delete_schedule))
        // Workflow management — DAG of task templates, n8n-style.
        .route("/api/workflows", post(crate::workflows::create_workflow))
        .route("/api/workflows/:id", axum::routing::delete(crate::workflows::delete_workflow))
        .route("/api/workflows/:id/run", post(crate::workflows::run_workflow))
        .route_layer(middleware::from_fn(require_api_key));

    // Public: read-only / health / dashboard / webhook fire. Anyone can call.
    let public = Router::new()
        // ── UI ─────────────────────────────────────────────────────────────
        .route("/", get(ui_index))
        // ── Webhook fire (public by design — that's the trigger contract) ──
        .route("/webhooks/:hook_id", post(crate::triggers::fire_webhook))
        // ── Trigger listing ────────────────────────────────────────────────
        .route("/api/webhooks", get(crate::triggers::list_webhooks))
        .route("/api/schedules", get(crate::triggers::list_schedules))
        // Workflow inspection
        .route("/api/workflows", get(crate::workflows::list_workflows))
        .route("/api/workflows/:id", get(crate::workflows::get_workflow))
        .route("/api/workflows/runs", get(crate::workflows::list_runs))
        .route("/api/workflows/runs/:run_id", get(crate::workflows::get_run))
        // ── Task queries ───────────────────────────────────────────────────
        .route("/api/tasks", get(list_tasks))
        .route("/api/tasks/:id", get(get_task))
        // ── Analytics ──────────────────────────────────────────────────────
        .route("/api/analytics/global", get(analytics_global))
        .route("/api/analytics/projects", get(analytics_projects))
        .route("/api/analytics/agents", get(analytics_agents))
        .route("/api/analytics/daily", get(analytics_daily))
        // ── Nemotron health (no spend) ─────────────────────────────────────
        .route("/api/nemotron/health", get(nemotron_health))
        // ── Intel gate status — drives the dashboard's Submit/Models lock ──
        .route("/api/intel/status", get(intel_status))
        // ── Solver self-learning loop ──────────────────────────────────────
        // Solver POSTs outcomes from inside the trusted network; reads of
        // outcomes + active skip-rules are open so the dashboard can show them.
        .route("/api/solver/outcomes", post(ingest_outcome).get(list_outcomes))
        .route("/api/solver/outcomes/count", get(count_outcomes_route))
        .route("/api/solver/skip-rules", get(list_skip_rules))
        // ── Webhook (openfang signs callbacks separately) ──────────────────
        .route("/webhook/openfang", post(openfang_webhook))
        // ── Health ─────────────────────────────────────────────────────────
        .route("/health", get(health))
        // ── Auth state — drives the dashboard's topbar pill + sign-in modal
        .route("/api/auth/status", get(auth_status));

    public.merge(ingest_router).merge(protected).with_state(state)
}

// ── UI ─────────────────────────────────────────────────────────────────────────

/// Embedded copy of the dashboard — used in release builds and as a debug-build
/// fallback if the on-disk file ever disappears.
const UI_INDEX_EMBEDDED: &str = include_str!("../static/index.html");

/// Serves the dashboard.
///
/// In debug builds (`cargo build`, no `--release`), this reads the HTML fresh
/// from disk on every request so edits to `static/index.html` hot-reload on the
/// next browser refresh — no rebuild required. In release builds the embedded
/// copy is used and the binary is fully self-contained.
async fn ui_index() -> Html<String> {
    #[cfg(debug_assertions)]
    {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/static/index.html");
        match tokio::fs::read_to_string(path).await {
            Ok(html) => return Html(html),
            Err(_) => { /* fall through to the embedded copy */ }
        }
    }
    Html(UI_INDEX_EMBEDDED.to_string())
}

// ── Health ─────────────────────────────────────────────────────────────────────

async fn health() -> Json<serde_json::Value> {
    Json(serde_json::json!({ "status": "ok", "service": "open-mamba" }))
}

// ── Intel gate ─────────────────────────────────────────────────────────────────
//
// Reports whether the dashboard's Submit + Models pages should be unlocked.
// Three independent paths can flip the gate to `enabled: true`:
//
//   1. BYO Nemotron host: `NEMOTRON_BASE_URL` is set
//   2. taifoon-intel:     `NEMOTRON_BASE_URL` points at *.taifoon.dev / *.taifoon.io
//   3. Operator sign-in:  request carries a valid `x-grid-key` header that matches
//                         the `TAIFOON_GRID_KEY` env var
//
// The endpoint is publicly readable; it never echoes the URL value, the
// configured key, or anything else secret — only presence/kind. The frontend
// sends `x-grid-key` from localStorage on every poll, so a sign-in flips the
// gate without any backend session state.
async fn intel_status(req: Request<axum::body::Body>) -> Json<serde_json::Value> {
    let endpoint = std::env::var("NEMOTRON_BASE_URL").ok();
    let mut kind = match endpoint.as_deref() {
        Some(url) if url.contains("taifoon.dev") || url.contains("taifoon.io") => "taifoon-intel",
        Some(_)  => "byo",
        None     => "none",
    };
    let mut enabled = endpoint.is_some();

    let (_, grid_authed) = grid_state(req.headers());
    if grid_authed {
        enabled = true;
        if kind == "none" { kind = "grid-key"; }
    }

    Json(serde_json::json!({
        "enabled": enabled,
        "kind":    kind,
        "via":     if grid_authed { "x-grid-key" } else if endpoint.is_some() { "env" } else { "none" },
        "adapters": if enabled { ["taifoon", "polymarket", "algotrada"].as_slice() } else { [].as_slice() },
    }))
}

// ── Auth state ─────────────────────────────────────────────────────────────────
//
// Single source of truth the dashboard uses to render the topbar AUTH pill and
// to gate nemotron model routing in the Submit dropdown.
//
//   mode:      "open"    → no TAIFOON_GRID_KEY env set, everything is unguarded
//              "guarded" → key configured; signing in unlocks nemotron routing
//   signed_in: bool      → request carried a matching `x-grid-key`
//   gates:     ["nemotron"] when the gate would actually kick in for that scope
//
// This endpoint is publicly readable; it returns presence/state flags only and
// never echoes the configured key or the URL value.
async fn auth_status(req: Request<axum::body::Body>) -> Json<serde_json::Value> {
    let (env_set, signed_in) = grid_state(req.headers());
    let mode = if env_set { "guarded" } else { "open" };
    let nemotron_endpoint = std::env::var("NEMOTRON_BASE_URL").ok();
    let intel_kind = match nemotron_endpoint.as_deref() {
        Some(url) if url.contains("taifoon.dev") || url.contains("taifoon.io") => "taifoon-intel",
        Some(_)  => "byo",
        None     => "none",
    };

    Json(serde_json::json!({
        "mode":       mode,
        "signed_in":  signed_in,
        "intel_kind": intel_kind,
        // Routes that the gate would protect when guarded + signed-out.
        "gates": if env_set { ["nemotron"].as_slice() } else { [].as_slice() },
    }))
}

// ── Ingest ─────────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct IngestRequest {
    pub project: String,
    pub assigned_agent: String,
    pub skill: Option<String>,
    pub model: Option<String>,
    pub payload: String,
    pub priority: Option<u8>,
    #[serde(default)]
    pub source: TaskSource,
}

/// Agents that always get an automatic code-reviewer pass after completion.
fn needs_reviewer(agent: &str) -> bool {
    matches!(agent, "coder" | "devops-lead")
}

async fn ingest_task(
    State(s): State<AppState>,
    Json(req): Json<IngestRequest>,
) -> impl IntoResponse {
    let model = req.model.unwrap_or_else(|| "claude-opus-4-7".to_string());
    let priority = req.priority.unwrap_or(5);

    // Coder/devops tasks are automatically wrapped in a 2-step workflow:
    // step 0 = the submitted task, step 1 = code-reviewer audit.
    // The workflow advancer chains them: when step 0 finishes, it injects
    // the full response as __previous and dispatches the reviewer.
    if needs_reviewer(&req.assigned_agent) {
        let wf_id = Uuid::new_v4().to_string();
        let workflow = Workflow {
            id: wf_id.clone(),
            name: format!("auto:{}", &req.project),
            steps: vec![
                WorkflowStep {
                    name: "deliver".into(),
                    project: req.project.clone(),
                    assigned_agent: req.assigned_agent.clone(),
                    skill: req.skill.clone(),
                    model: model.clone(),
                    payload: req.payload.clone(),
                    priority,
                },
                WorkflowStep {
                    name: "review".into(),
                    project: req.project.clone(),
                    assigned_agent: "code-reviewer".into(),
                    skill: None,
                    model: "claude-sonnet-4-6".into(),
                    payload: req.payload.clone(), // reviewer sees __previous injected by advancer
                    priority: priority.saturating_add(1),
                },
            ],
            enabled: true,
            created_at: Utc::now(),
            last_run_at: None,
            run_count: 0,
        };
        if let Err(e) = s.lake.upsert_workflow(&workflow) {
            return (StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() }))).into_response();
        }

        // Build and submit the first step directly, then create the run record
        // tracking it — the workflow advancer picks up from there.
        let first_step = &workflow.steps[0];
        let envelope = TaskEnvelope::new(
            first_step.project.clone(),
            req.source,
            first_step.assigned_agent.clone(),
            first_step.skill.clone(),
            first_step.model.clone(),
            first_step.payload.clone(),
            first_step.priority,
        );
        let task_id = envelope.id;
        let run = WorkflowRun {
            run_id: Uuid::new_v4().to_string(),
            workflow_id: wf_id.clone(),
            status: "running".into(),
            current_step: 0,
            outputs: vec![],
            initial_input: Some(req.payload.clone()),
            started_at: Utc::now(),
            completed_at: None,
            error: None,
            current_task_id: Some(task_id),
        };
        if let Err(e) = s.lake.insert_run(&run) {
            return (StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() }))).into_response();
        }
        return match s.bus.submit(envelope).await {
            Ok(_) => (StatusCode::ACCEPTED, Json(serde_json::json!({
                "id": task_id,
                "workflow_id": wf_id,
                "run_id": run.run_id,
                "auto_review": true,
            }))).into_response(),
            Err(e) => (StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
        };
    }

    // Non-coder agents (nemotron, planner, etc.) go straight to the bus.
    let envelope = TaskEnvelope::new(
        req.project,
        req.source,
        req.assigned_agent,
        req.skill,
        model,
        req.payload,
        priority,
    );
    let id = envelope.id;
    match s.bus.submit(envelope).await {
        Ok(_) => (StatusCode::ACCEPTED, Json(serde_json::json!({ "id": id }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

// ── Task queries ───────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct ListQuery {
    project: Option<String>,
    status: Option<String>,
    limit: Option<i64>,
}

async fn list_tasks(
    State(s): State<AppState>,
    Query(q): Query<ListQuery>,
) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(100);
    lake_response(
        s.lake.query_tasks(q.project.as_deref(), q.status.as_deref(), limit)
    )
}

async fn get_task(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match s.lake.get_task(id) {
        Ok(Some(row)) => Json(serde_json::to_value(row).unwrap()).into_response(),
        Ok(None) => (StatusCode::NOT_FOUND, Json(serde_json::json!({ "error": "not found" }))).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

// ── Retry / re-dispatch ───────────────────────────────────────────────────────

/// POST /api/tasks/:id/retry — reset a task to pending so the worker
/// picks it up on its next poll.
async fn retry_task(
    State(s): State<AppState>,
    Path(id): Path<Uuid>,
) -> impl IntoResponse {
    match s.lake.reset_to_pending(&[id]) {
        Ok(n) if n > 0 => (
            StatusCode::ACCEPTED,
            Json(serde_json::json!({ "id": id, "reset": true })),
        )
            .into_response(),
        Ok(_) => (
            StatusCode::NOT_FOUND,
            Json(serde_json::json!({ "error": "not found" })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

/// POST /api/tasks/retry-pending — reset all dispatched/running/failed
/// rows back to pending. The worker drains them on its next poll.
async fn retry_pending(State(s): State<AppState>) -> impl IntoResponse {
    match s.lake.reset_stuck_tasks() {
        Ok(n) => (
            StatusCode::ACCEPTED,
            Json(serde_json::json!({ "reset": n })),
        )
            .into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        )
            .into_response(),
    }
}

pub(crate) fn envelope_from_row(row: &mamba_lake::TaskRow) -> anyhow::Result<TaskEnvelope> {
    let id = Uuid::parse_str(&row.id)?;
    let source = match row.source.as_str() {
        "claude_desktop" => TaskSource::ClaudeDesktop,
        "claude_opus"    => TaskSource::ClaudeOpus,
        "cron"           => TaskSource::Cron,
        "webhook"        => TaskSource::Webhook,
        _                => TaskSource::Api,
    };
    let created_at = row.created_at.parse().unwrap_or_else(|_| Utc::now());
    Ok(TaskEnvelope {
        id,
        project:           row.project.clone(),
        source,
        assigned_agent:    row.assigned_agent.clone(),
        skill:             row.skill.clone(),
        model:             row.model.clone(),
        payload:           row.payload.clone(),
        priority:          row.priority.max(0) as u8,
        status:            TaskStatus::Pending,
        openfang_job_id:   None,
        tokens_in:         row.tokens_in,
        tokens_out:        row.tokens_out,
        cost_usd:          row.cost_usd,
        encrypted_payload: None,
        chain_tx:          None,
        created_at,
        dispatched_at:     None,
        completed_at:      None,
    })
}

// ── Analytics ─────────────────────────────────────────────────────────────────

fn lake_response<T: Serialize>(result: anyhow::Result<T>) -> impl IntoResponse {
    match result {
        Ok(data) => Json(serde_json::to_value(data).unwrap()).into_response(),
        Err(e) => (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()).into_response(),
    }
}

async fn analytics_global(State(s): State<AppState>) -> impl IntoResponse {
    lake_response(s.lake.global_consumption())
}
async fn analytics_projects(State(s): State<AppState>) -> impl IntoResponse {
    lake_response(s.lake.per_project_consumption())
}
async fn analytics_agents(State(s): State<AppState>) -> impl IntoResponse {
    lake_response(s.lake.per_agent_consumption())
}
async fn analytics_daily(State(s): State<AppState>) -> impl IntoResponse {
    lake_response(s.lake.daily_burn_last_30())
}

// ── Nemotron proxy ─────────────────────────────────────────────────────────────

async fn nemotron_health(State(s): State<AppState>) -> Json<serde_json::Value> {
    let results = s.nemotron.health_all().await;
    let map: serde_json::Map<_, _> = results
        .into_iter()
        .map(|(a, ok)| (a.slug().to_string(), serde_json::Value::Bool(ok)))
        .collect();
    Json(serde_json::Value::Object(map))
}

#[derive(Deserialize)]
struct GenerateBody {
    prompt: String,
    max_tokens: Option<u32>,
    system: Option<String>,
}

async fn nemotron_generate(
    State(s): State<AppState>,
    Path(model): Path<String>,
    Json(body): Json<GenerateBody>,
) -> impl IntoResponse {
    let Some(adapter) = NemotronAdapter::from_model_str(&model) else {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({ "error": "unknown model" }))).into_response();
    };
    match s.nemotron.generate(adapter, &body.prompt, body.system.as_deref(), body.max_tokens).await {
        Ok(resp) => Json(serde_json::to_value(resp).unwrap()).into_response(),
        Err(e) => (StatusCode::BAD_GATEWAY, Json(serde_json::json!({ "error": e.to_string() }))).into_response(),
    }
}

// ── Webhook ────────────────────────────────────────────────────────────────────

async fn openfang_webhook(
    State(_s): State<AppState>,
    Json(payload): Json<serde_json::Value>,
) -> StatusCode {
    tracing::info!(payload = ?payload, "openfang webhook received");
    StatusCode::OK
}

// ── Solver self-learning loop (X1) ────────────────────────────────────────────

/// Wire shape posted by the solver after every executed/skipped intent.
/// Matches `taifoon-solver::executor::outcome_log::OutcomeRecord` plus the
/// X1 fields (`predicted_*`, `skip_reason`).
#[derive(Deserialize)]
struct OutcomeIngest {
    #[serde(default = "default_now")]
    ts: chrono::DateTime<Utc>,
    intent_id: String,
    protocol: String,
    src_chain: u64,
    dst_chain: u64,
    decision: String,
    tx_hash: Option<String>,
    /// Pre-flight estimate from gas estimator.
    predicted_gas: Option<u64>,
    /// Receipt-derived `gas_used` (post-fill).
    #[serde(alias = "gas_used")]
    actual_gas: Option<u64>,
    effective_gas_price_wei: Option<String>,
    predicted_profit_usd: Option<f64>,
    actual_profit_usd: Option<f64>,
    skip_reason: Option<String>,
    error: Option<String>,
}

fn default_now() -> chrono::DateTime<Utc> { Utc::now() }

async fn ingest_outcome(
    State(s): State<AppState>,
    Json(req): Json<OutcomeIngest>,
) -> impl IntoResponse {
    let row = SolverOutcomeRow {
        ts: req.ts.to_rfc3339(),
        intent_id: req.intent_id,
        protocol: req.protocol,
        src_chain: req.src_chain,
        dst_chain: req.dst_chain,
        decision: req.decision,
        tx_hash: req.tx_hash,
        predicted_gas: req.predicted_gas,
        actual_gas: req.actual_gas,
        effective_gas_price_wei: req.effective_gas_price_wei,
        predicted_profit_usd: req.predicted_profit_usd,
        actual_profit_usd: req.actual_profit_usd,
        skip_reason: req.skip_reason,
        error: req.error,
    };
    match s.lake.insert_outcome(&row) {
        Ok(_) => (StatusCode::ACCEPTED, Json(serde_json::json!({ "ok": true }))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response(),
    }
}

#[derive(Deserialize)]
struct OutcomeListQuery {
    limit: Option<i64>,
}

async fn list_outcomes(
    State(s): State<AppState>,
    Query(q): Query<OutcomeListQuery>,
) -> impl IntoResponse {
    let limit = q.limit.unwrap_or(100).clamp(1, 5000);
    lake_response(s.lake.recent_outcomes(limit))
}

async fn count_outcomes_route(State(s): State<AppState>) -> impl IntoResponse {
    match s.lake.count_outcomes() {
        Ok(n) => Json(serde_json::json!({ "count": n })).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response(),
    }
}

async fn list_skip_rules(State(s): State<AppState>) -> impl IntoResponse {
    lake_response(s.lake.list_active_skip_rules())
}

#[derive(Deserialize)]
struct PublishSkipRules {
    protocol: String,
    rules: Vec<SkipRuleInput>,
}

#[derive(Deserialize)]
struct SkipRuleInput {
    rule_json: String,
    description: Option<String>,
    confidence: f64,
    sample_size: u64,
}

async fn publish_skip_rules(
    State(s): State<AppState>,
    Json(req): Json<PublishSkipRules>,
) -> impl IntoResponse {
    let now = Utc::now().to_rfc3339();
    let rows: Vec<SolverSkipRuleRow> = req
        .rules
        .into_iter()
        .map(|r| SolverSkipRuleRow {
            id: Uuid::new_v4().to_string(),
            protocol: req.protocol.clone(),
            rule_json: r.rule_json,
            description: r.description,
            confidence: r.confidence,
            sample_size: r.sample_size,
            active: true,
            created_at: now.clone(),
            superseded_at: None,
        })
        .collect();
    match s.lake.replace_skip_rules(&req.protocol, &rows) {
        Ok(n) => (
            StatusCode::ACCEPTED,
            Json(serde_json::json!({ "protocol": req.protocol, "published": n })),
        ).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(serde_json::json!({ "error": e.to_string() })),
        ).into_response(),
    }
}
