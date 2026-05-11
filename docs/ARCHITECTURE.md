# open-mamba — Architecture

## Component map

```
┌─────────────────────────────────────────────────────────────────┐
│                         open-mamba                              │
│                                                                 │
│  ┌──────────────┐   ┌──────────────┐   ┌──────────────────┐   │
│  │  mamba-api   │   │  mamba-bus   │   │  mamba-lake      │   │
│  │  :1337       │   │  dispatcher  │   │  DuckDB          │   │
│  │              │   │              │   │  data/mamba.db   │   │
│  │  POST /ingest│──►│  route()     │──►│  tasks table     │   │
│  │  webhooks    │   │              │   │  costs table     │   │
│  │  cron tick   │   │  nemotron?   │   │  workflows table │   │
│  └──────────────┘   │  openfang?   │   └──────────────────┘   │
│                     └──────┬───────┘                           │
└────────────────────────────┼────────────────────────────────────┘
                             │
              ┌──────────────┴──────────────────┐
              ▼                                 ▼
   ┌─────────────────────┐          ┌────────────────────────┐
   │  openfang :4200     │          │  nemotron HTTP client  │
   │  agents/            │          │  crates/mamba-nemotron │
   │  coder (sonnet)     │          │                        │
   │  code-reviewer(opus)│          │  POST /taifoon/generate│
   │  overseer (sonnet)  │          │  POST /polymarket/gen  │
   │  taifoon-intel      │          │  auth: bearer or grid  │
   └─────────────────────┘          └────────────────────────┘
```

## Crates

| Crate | Role |
|---|---|
| `mamba-api` | Axum HTTP server. `/ingest`, `/api/tasks/*`, `/api/webhooks/*`, `/api/schedules/*`, `/api/workflows/*` |
| `mamba-bus` | Route decisions: `nemotron/*` models → direct HTTP; everything else → openfang `POST /api/agents/{id}/message` |
| `mamba-lake` | DuckDB persistence. Tasks, costs, verdicts, workflow runs — all go here |
| `mamba-nemotron` | Nemotron HTTP client with `x-taifoon-key` grid-key auth and `Bearer` fallback |
| `mamba-types` | Shared types (MIT-licensed, stable public API) |

## Task lifecycle

```
pending → dispatched → done
                    → failed (retry_count < 3 → pending)
                    → blocked (permanent)
```

- Worker polls every 2s, max 4 concurrent in-flight
- 15-min stuck-task reaper resets `dispatched` tasks back to `pending`
- 20-min hard dispatch timeout kills the HTTP call and marks `failed`

## Coder → reviewer auto-workflow

Any task with `assigned_agent: coder` automatically spawns a second `code-reviewer` task chained via `workflow_id`. The reviewer sees the coder's full output as context.

Reviewer verdicts:
- `APPROVED` / `LGTM` / `CONFIRMED` → workflow succeeds
- `CHANGES_REQUESTED` → re-dispatch coder with reviewer feedback, up to 3 rounds
- `BLOCKED` → workflow permanently fails, no retry

## Storage

| Path | What |
|---|---|
| `data/mamba.duckdb` | Main task lake |
| `~/.mamba/runtime.env` | Runtime secrets (API keys, ports, encrypt key) |
| `~/.mamba/logs/` | Rolling log files |
| `~/.mamba/{open-mamba,openfang}.pid` | Daemon PID files |
| `~/.openfang/data/openfang.db` | openfang agent/session state |

## Nemotron routing

Adapter slugs forwarded verbatim: `nemotron/taifoon`, `nemotron/polymarket`, `nemotron/algotrada`.

Auth priority:
1. `TAIFOON_GRID_KEY` (header: `x-taifoon-key`) — on-chain metered billing
2. `NEMOTRON_API_KEY` (header: `Authorization: Bearer`) — self-hosted / OpenAI-compatible
3. No auth — unauthenticated self-host

## On-chain billing anchor

Every completed task writes a `chain_tx` back to the DuckDB record. This is the on-chain anchor used by the Taifoon grid contract to validate billing. No chain_tx = task not metered.
