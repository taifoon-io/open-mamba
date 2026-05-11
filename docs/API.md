# open-mamba HTTP API

The mamba task bus runs on port **1337** (configurable via `MAMBA_PORT`).

## Authentication

By default the API is unauthenticated (intended for local use). Set `MAMBA_API_KEY`
to enable bearer-token auth on all routes except `/`.

```
Authorization: Bearer <your-api-key>
```

---

## Tasks

### `POST /ingest`

Enqueue a single task on the bus.

**Request body** (`application/json`):

| Field | Type | Required | Description |
|---|---|---|---|
| `project` | string | yes | Logical project name (e.g. `"taifoon-solver"`) |
| `assigned_agent` | string | yes | openfang agent slug (e.g. `"coder"`, `"code-reviewer"`) |
| `model` | string | yes | Inference model (e.g. `"claude-sonnet-4-6"`) |
| `payload` | string | yes | Free-form task description / instructions |
| `priority` | u8 | no | 1 = highest; default 5 |
| `skill` | string \| null | no | openfang skill slug |
| `source` | string | no | `"api"` (default), `"cron"`, `"webhook"` |

**Response** `201`:

```json
{ "id": "44c33791-a047-4272-b429-55afcd9c4567" }
```

**curl example**:

```bash
curl -X POST http://localhost:1337/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "project": "taifoon-solver",
    "assigned_agent": "coder",
    "model": "claude-sonnet-4-6",
    "payload": "Add input validation to the Across adapter fee check.",
    "priority": 7
  }'
```

---

### `GET /api/tasks`

List all tasks (most recent first).

**Response** `200` — array of `TaskEnvelope` objects:

```json
[
  {
    "id": "44c33791-...",
    "project": "taifoon-solver",
    "assigned_agent": "coder",
    "model": "claude-sonnet-4-6",
    "payload": "...",
    "priority": 7,
    "status": "done",
    "cost_usd": 0.023,
    "tokens_in": 1200,
    "tokens_out": 850,
    "created_at": "2026-05-10T20:26:34Z",
    "completed_at": "2026-05-10T20:28:01Z"
  }
]
```

---

### `GET /api/tasks/:id`

Fetch a single task by UUID.

---

### `POST /api/tasks/:id/retry`

Re-enqueue a failed task (status reset to `pending`).

**Response** `200`: `{ "ok": true }`

---

### `POST /api/tasks/retry-pending`

Bulk-retry all tasks whose status is `"pending"` (useful after bus restart).

**Response** `200`: `{ "retried": 3 }`

---

## Workflows

A workflow is an ordered chain of task templates. Each run executes the steps
in sequence; the previous step's output is injected as context for the next.

The coder → code-reviewer pattern is the canonical two-step workflow.

### `POST /api/workflows`

Create a workflow definition.

**Request body**:

```json
{
  "name": "auto:taifoon-solver",
  "steps": [
    {
      "name": "deliver",
      "assigned_agent": "coder",
      "model": "claude-sonnet-4-6",
      "project": "taifoon-solver",
      "priority": 8,
      "payload": "Implement the Across adapter fee floor check.",
      "skill": null
    },
    {
      "name": "review",
      "assigned_agent": "code-reviewer",
      "model": "claude-sonnet-4-6",
      "project": "taifoon-solver",
      "priority": 9,
      "payload": "Review the Across adapter implementation.",
      "skill": null
    }
  ]
}
```

**Response** `201`: `{ "id": "a0e0e448-..." }`

---

### `GET /api/workflows`

List all workflow definitions.

---

### `GET /api/workflows/:id`

Get a single workflow definition by UUID.

---

### `DELETE /api/workflows/:id`

Delete a workflow definition (does not affect existing runs).

---

### `POST /api/workflows/:id/run`

Trigger an immediate run of the workflow. The first step is dispatched
synchronously; subsequent steps fire as the previous step completes.

**Request body**: `{}` (no required fields)

**Response** `200`:

```json
{
  "run_id": "d73ac6a4-...",
  "step": 0,
  "task_id": "44c33791-..."
}
```

**curl example**:

```bash
curl -X POST http://localhost:1337/api/workflows/a0e0e448-b26d-4527-a459-ad090616d1f7/run \
  -H "Content-Type: application/json" -d '{}'
```

---

### `GET /api/workflows/runs`

List all workflow runs (most recent first). Each run includes the full
`outputs` array with per-step agent responses and verdicts.

**Response** `200` (abbreviated):

```json
[
  {
    "run_id": "d73ac6a4-...",
    "workflow_id": "a0e0e448-...",
    "status": "completed",
    "current_step": 2,
    "current_task_id": null,
    "initial_input": null,
    "started_at": "2026-05-10T20:26:36Z",
    "completed_at": "2026-05-10T20:31:02Z",
    "error": null,
    "outputs": [
      {
        "step": 0,
        "agent": "coder",
        "task_id": "44c33791-...",
        "response": "Implemented the Across adapter fee floor check...",
        "verdict": null,
        "cost_usd": 0.023,
        "tokens_in": 1200,
        "tokens_out": 850
      },
      {
        "step": 1,
        "agent": "code-reviewer",
        "task_id": "6f8d17ce-...",
        "response": "**APPROVED** — implementation matches spec.",
        "verdict": "approved",
        "cost_usd": 0.007,
        "tokens_in": 400,
        "tokens_out": 180
      }
    ]
  }
]
```

---

### `GET /api/workflows/runs/:run_id`

Fetch a single run by UUID.

---

## Schedules (cron triggers)

### `POST /api/schedules`

Register a recurring task that fires on a cron schedule.

**Request body**:

```json
{
  "schedule_id": "my-weekly-report",
  "cron": "0 9 * * 1",
  "project": "taifoon-solver",
  "assigned_agent": "overseer",
  "model": "claude-sonnet-4-6",
  "payload": "Generate a weekly solver performance report.",
  "priority": 5
}
```

**Response** `201`: `{ "id": "d0a4dea8-..." }`

---

### `GET /api/schedules`

List all registered schedules.

---

### `DELETE /api/schedules/:id`

Delete a schedule.

---

## Webhooks

### `POST /api/webhooks`

Register a named inbound webhook. When the webhook URL receives a POST,
the configured task is enqueued.

**Request body**:

```json
{
  "hook_id": "github-pr-open",
  "project": "taifoon-solver",
  "assigned_agent": "coder",
  "model": "claude-sonnet-4-6",
  "payload": "A new PR was opened. Review scope and create a delivery brief.",
  "priority": 6
}
```

**Response** `201`: `{ "id": "abc-...", "url": "http://localhost:1337/webhooks/github-pr-open" }`

---

### `GET /api/webhooks`

List all webhooks.

---

### `DELETE /api/webhooks/:hook_id`

Delete a webhook.

---

### `POST /webhooks/:hook_id`

Fire a registered webhook. The request body is forwarded as context to the
agent payload.

---

## Analytics

All analytics endpoints return read-only aggregates from the DuckDB lake.

### `GET /api/analytics/global`

Overall totals: tasks dispatched, tasks completed, total cost, total tokens.

### `GET /api/analytics/projects`

Per-project breakdown.

### `GET /api/analytics/agents`

Per-agent breakdown (tasks, cost, avg tokens).

### `GET /api/analytics/daily`

Daily cost and task counts for the past 30 days.

---

## Nemotron / Intel

### `POST /api/nemotron/:model/generate`

Forward a generation request to the Nemotron GPU endpoint
(`NEMOTRON_BASE_URL`). Requires Taifoon-grid billing credit.

### `GET /api/nemotron/health`

Check Nemotron endpoint reachability.

### `GET /api/intel/status`

Return taifoon-intel agent auth status and upstream model health.

---

## UI

### `GET /`

Returns the built-in dashboard HTML (`static/index.html`) — a single-page
view of recent tasks, workflow runs, and cost analytics.
