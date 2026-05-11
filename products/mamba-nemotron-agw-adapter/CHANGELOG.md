# Changelog

All notable changes to `mamba-nemotron-agw-adapter` are documented in this
file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
versioning follows [SemVer 2.0.0](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial scaffold of the standalone product folder.
- `docs/SPEC.md` — full lege artis component specification (20 sections).
- `docs/DESIGN_TOKENS.md` — Claude-inspired design system tokens for the
  marketing site.
- `helm/` — chart skeleton: `Chart.yaml`, `values.yaml`, deployment / service
  / network policy / OPA bundle templates.
- `site/` — Next.js 14 App Router marketing site with home, spec, install,
  pricing pages; static export for nginx serving.
- `deploy/nginx/mamba.taifoon.dev` — nginx server block for HTTPS site at
  `mamba.taifoon.dev`.
- `deploy/deploy.sh` — build + push helper that drives the stochastic
  bridge for remote shell ops.
- BSL 1.1 licence with automatic Apache 2.0 conversion on 2029-05-06.
- Initial `README.md` with quick install and Solo.io `Upstream` snippet.

## [0.1.0] — pending

First public release. Targets:
- Solo.io Verified Partner listing
- Helm chart `oci://ghcr.io/yawningmonsoon/charts/mamba-nemotron-agw-adapter:0.1.0`
- OCI image `ghcr.io/yawningmonsoon/mamba-nemotron-agw-adapter:0.1.0`

[Unreleased]: https://github.com/yawningmonsoon/mamba-nemotron-agw-adapter/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/yawningmonsoon/mamba-nemotron-agw-adapter/releases/tag/v0.1.0
