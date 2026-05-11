# open-mamba — Agent Reference

Agents are defined as TOML manifests in `agents/openfang-manifests/`. Each manifest maps to an openfang agent process. The `mamba-bus` dispatcher routes tasks to the correct agent by slug.

## Built-in agents

### `coder`

- **Model**: claude-sonnet-4-6 (via openfang claude-code provider)
- **Role**: Ships code, fixes bugs across spinner / taifoon-eco / taifoon-solver / open-mamba
- **Auto-chains**: yes — every `coder` task gets a `code-reviewer` follow-up automatically
- **Skills used**: fix-collector, simplify

### `code-reviewer`

- **Model**: claude-opus-4-7
- **Role**: Audits coder output. Emits `APPROVED`, `CHANGES_REQUESTED`, or `BLOCKED`
- **Auto-chains**: no — terminal step in the coder→reviewer workflow
- **Skills used**: review, security-review

### `overseer`

- **Model**: claude-sonnet-4-6
- **Role**: Queue watchdog. Receives a JSON status snapshot, produces a markdown health report
- **Trigger**: cron (typically every 30m) or manual POST /ingest
- **Output**: HEALTHY / DEGRADED / STALLED verdict + per-task breakdown

### `taifoon-intel`

- **Model**: nemotron/taifoon (direct Nemotron HTTP, bypasses openfang)
- **Role**: Cross-chain protocol intelligence — bridge fees, fill rates, route comparison
- **Auth**: TAIFOON_GRID_KEY (on-chain metered) or NEMOTRON_API_KEY (self-host)
- **Skills used**: taifoon-agent

## Builders Programme reviewer agents

These are Python agents invoked by `orchestrator.py` — not openfang-based. They run the automated adapter review pipeline for the [Taifoon Builders Programme](https://taifoon.io/builders).

### `evm_replay`

- **Path**: `agents/evm_replay/agent.py`
- **Role**: Replays EVM-class adapter submissions against a historical block set, diffs decoded output against reference fills, emits a signed `reviewer_verdict_v1`
- **Inputs**: submission tarball (contains `decoder.py` exposing `decode_event(log) -> dict`), replay block set (content-addressed)
- **Output**: `APPROVED` | `CHANGES_REQUESTED` | `BLOCKED` + fill accuracy stats
- **Production hardening**: runs inside Intel SGX / AMD SEV-SNP enclave; HSM-signed verdicts registered on-chain in `BuildersRegistry`

### `schema_conformer`

- **Path**: `agents/schema_conformer/agent.py`
- **Role**: Validates adapter output conforms to `fill_event_v1` JSON Schema; second reviewer on every bounty per `reviewers.xml <defaults>`
- **Inputs**: submission tarball + `verdict_schemas/fill_event_v1.json`
- **Output**: `APPROVED` (schema valid) | `CHANGES_REQUESTED` (violations listed) | `BLOCKED` (missing required fields)

### Running locally

```bash
# Test evm_replay against a local submission:
python3 -m agents.evm_replay.agent ./submission.tar.gz ./replay-sets/evm/v1/sample/

# Test schema_conformer:
python3 -m agents.schema_conformer.agent ./submission.tar.gz
```

Both agents are dependency-free (stdlib only) for the bootstrap implementation.

## Adding a new agent

1. Create `agents/openfang-manifests/<slug>.toml`
2. Run `mamba register-agents`
3. Submit tasks with `assigned_agent: "<slug>"`

The manifest format:

```toml
name = "<slug>"
version = "0.1.0"
description = "..."
author = "open-mamba"
module = "builtin:chat"

[model]
provider = "claude-code"   # or "default" for nemotron
model = "claude-code/sonnet"
max_tokens = 8192
temperature = 0.1
system_prompt = """..."""
```

## Delivery channel

All agents deliver to Telegram by default (configured in `~/.mamba/runtime.env`). The delivery channel is set per-agent in the manifest and can be overridden per-task via the `delivery_to` field in the ingest payload.
