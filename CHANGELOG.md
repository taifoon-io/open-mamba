# Changelog

All notable changes to open-mamba are documented here.

## [Unreleased]

- Overseer agent using `/loop` dynamic wakeup — queue depth monitor
- Webhook completion delivery (Telegram, Slack, email)
- Per-agent token budgets enforced at dispatch time

## [0.1.0] — 2026-05-10

Initial public release.

### Added

- Durable DuckDB task queue — WAL-safe, survives restarts
- `POST /ingest` HTTP API — accepts tasks with project, agent, model, payload, priority
- Coder → reviewer auto-workflow — every `coder` task chains a `code-reviewer` step, no manual DAG needed
- Reviewer feedback loop — `CHANGES_REQUESTED` re-dispatches coder with full context, up to 3 fixup rounds; `BLOCKED` permanently fails
- Nemotron adapter routing — `nemotron/<adapter>` tasks hit `NEMOTRON_BASE_URL` directly
- Taifoon-grid payment integration — `x-taifoon-key` auth, on-chain metered billing, `chain_tx` written per task
- HTTP webhook triggers — register once, fire from any external service
- Cron schedules — 5-field UTC expressions, 30s internal tick, no system cron needed
- DAG workflow runner — linear chains with `__previous` output injection
- `mamba up` / `mamba down` / `mamba status` / `mamba logs` CLI
- `mamba git-init` / `mamba whoami` — git identity alignment with active `gh` account
- 15-min stuck-task reaper + 20-min hard dispatch timeout
- Transient-error retry with backoff vs permanent failure (4xx)
- CI: cargo fmt + clippy + test + gitleaks secret scan on every push/PR
- Agent manifests: `coder`, `code-reviewer`, `overseer`, `taifoon-intel`
