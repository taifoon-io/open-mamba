# crates/ — pointer to upstream

The Rust source for the adapter is **not duplicated here**. It lives in the
parent `open-mamba` workspace and is consumed via Cargo path or git
dependency at build time:

```toml
[dependencies]
mamba-types     = { path = "../../crates/mamba-types" }
mamba-nemotron  = { path = "../../crates/mamba-nemotron" }
mamba-api       = { path = "../../crates/mamba-api" }
```

Or, when this folder is split out into its own repository via
`git subtree split` / `git filter-repo`:

```toml
[dependencies]
mamba-types     = { git = "https://github.com/yawningmonsoon/open-mamba", tag = "v0.1.0" }
mamba-nemotron  = { git = "https://github.com/yawningmonsoon/open-mamba", tag = "v0.1.0" }
mamba-api       = { git = "https://github.com/yawningmonsoon/open-mamba", tag = "v0.1.0" }
```

This keeps a single source of truth for the underlying crates while
allowing the adapter — together with its Helm chart, marketing site, and
deployment glue — to ship as a discrete product under its own release
cadence and licence terms (BSL 1.1).
