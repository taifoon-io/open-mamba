# mamba-nemotron-agw-adapter

> Governed NVIDIA Nemotron upstream provider for **Solo.io Agentgateway**.
> One Helm chart, every Agent OS guarantee — EU AI Act audit trail, NIST AI
> RMF measurement, ISO 42001 controls, SOC 2 posture — without writing
> Triton glue.

[![Status: Beta](https://img.shields.io/badge/status-beta-orange)]()
[![Licence: BSL 1.1 → Apache 2.0](https://img.shields.io/badge/licence-BSL_1.1_→_Apache_2.0-blue)](LICENSE.md)
[![Solo.io: Upstream Provider](https://img.shields.io/badge/Solo.io-Upstream_Provider-1B7CFF)](https://www.solo.io/)

## Why

Solo.io Agentgateway routes to OpenAI, Bedrock, Azure OpenAI, Vertex, and
LiteLLM-fronted OSS models. It has no first-class governed adapter for the
**NVIDIA Nemotron** family — Nemotron-4 340B, Llama-3.1-Nemotron-70B,
Nemotron-Mini-4B. Every institution that bought DGX/Spectrum-X capacity in
2024–25 has the same forced choice: burn budget on hyperscaler tokens
despite paid-for on-prem inference, or wire ungoverned Triton glue and lose
every Agent OS guarantee.

This adapter closes that gap. Drop in one Helm chart, register one
`Upstream`, get Nemotron behind Agentgateway with audit, lineage, capability
enforcement, and certificate-bound model approval.

## What ships in this repo

| Path | What |
|---|---|
| [`docs/SPEC.md`](docs/SPEC.md) | Full **lege artis** component specification — 20 sections, every Agent OS slot mapped |
| [`docs/DESIGN_TOKENS.md`](docs/DESIGN_TOKENS.md) | Design system tokens for the marketing site (Claude-inspired warm-neutral language) |
| [`helm/`](helm/) | Helm chart skeleton (`Chart.yaml`, `values.yaml`, templates) |
| [`crates/README.md`](crates/README.md) | Pointer to Rust crates upstream in `open-mamba` |
| [`site/`](site/) | Marketing site (Next.js 14, App Router, static export) |
| [`deploy/`](deploy/) | nginx server block + deploy helper for `mamba.taifoon.dev` |
| [`CHANGELOG.md`](CHANGELOG.md) | Versioned change log (Keep A Changelog format) |
| [`LICENSE.md`](LICENSE.md) | BSL 1.1 with automatic conversion to Apache 2.0 after 36 months |

## Quick install

```bash
helm install mamba-nemotron-agw-adapter \
  oci://ghcr.io/yawningmonsoon/charts/mamba-nemotron-agw-adapter \
  --version 0.1.0 \
  -n agent-runtime --create-namespace \
  --set agentos.certificateRef=cert-mamba-nemotron-agw-adapter-0.1.0 \
  --set triton.endpoint=triton-inference.gpu-pool.svc.cluster.local:8001
```

Then register the Solo.io `Upstream` (full snippet in
[`docs/SPEC.md` §10](docs/SPEC.md)):

```yaml
apiVersion: gateway.solo.io/v1
kind: Upstream
metadata:
  name: nemotron-on-prem
  namespace: gloo-system
spec:
  ai:
    provider:
      openaiCompatible:
        baseUrl: "http://mamba-nemotron-agw-adapter.agent-runtime.svc.cluster.local:8080/v1"
        models: [nemotron-4-340b-instruct, llama-3.1-nemotron-70b-instruct, nemotron-mini-4b-instruct]
```

## Maturity

**Beta.** Eligible for paid pilots with design-partner support. Not yet
eligible for unattended production. See [`docs/SPEC.md` §1](docs/SPEC.md)
for full classification.

## Governance

Component certification, evaluation, and ongoing governance follow the
**Agent OS framework reference** maintained in `taifoon-intel`. Every
release passes the **8-Dimension Evaluation** (accuracy, security,
infrastructure compliance, regulatory compliance, data governance,
guardrail adherence, capability governance, auditability). Any single FAIL
halts release.

## Licence

[BSL 1.1](LICENSE.md) — restricts competitive hosted offerings during the
change-licence window. Automatically converts to **Apache License 2.0** on
**2029-05-06** (36 months from initial release).

## Off-sell channel

Built and listed as a **Solo.io Verified Partner** integration. Co-sell
motion: mutual referral, joint solution brief, listed on both vendors'
partner pages. Enterprise-tier support contracts and OEM bundling are
available — see [`site/`](site/) (or visit https://mamba.taifoon.dev) for
the current pricing matrix.

## Owner

`yawningmonsoon` · maciej@t3rn.io
