# Contributing to open-mamba

open-mamba is MIT-licensed. Contributions welcome via PR.

## Setup

```bash
git clone https://github.com/taifoon-io/open-mamba
cd open-mamba
cargo build --workspace
```

Requires: Rust stable, Python 3.11+ (for `pyo3` bindings).

## Before opening a PR

```bash
cargo fmt --all
cargo clippy --workspace -- -D warnings -A dead_code -A unused
cargo test --workspace
```

Secret scan runs automatically on every PR via gitleaks. Make sure no credentials are in the diff — see `.gitleaks.toml` for the patterns checked.

## Agent manifests

To add or modify an agent, edit `agents/openfang-manifests/<slug>.toml`. Run `mamba register-agents` after changing manifests — no binary rebuild needed.

## Crate layout

| Crate | Stable public API? |
|---|---|
| `mamba-types` | Yes — MIT, semver-stable |
| `mamba-lake` | Internal |
| `mamba-bus` | Internal |
| `mamba-nemotron` | Internal |
| `mamba-chain` | Internal |
| `mamba-api` | Internal |

Only `mamba-types` is part of the public API surface. All other crates are internal and may change without notice.

## License

MIT. By submitting a PR you agree your contribution is licensed under MIT.
Adapters built using open-mamba and registered via BuildersRegistry are additionally subject to TSUL — see [`taifoon-io/license`](https://github.com/taifoon-io/license).
