# `mamba-nemotron-agw-adapter` — Component Specification

> **Status:** DRAFT v0.1 · 2026-05-06
> **Owner:** yawningmonsoon (maciej@t3rn.io)
> **Spec author:** Agent OS productization workstream
> **Authoritative reference:** `taifoon-intel/docs/AGENT_OS_FRAMEWORK_REFERENCE.md` (FROZEN)
> **Off-sell channel:** Solo.io co-sell — Agentgateway upstream provider listing
> **Audience:** Solo.io platform engineering, Solo.io product leadership, AIG-class regulated-institution architecture review boards

This document specifies the first wedge component being productized out of the
`open-mamba` workspace under the Agent OS framework. It is written **lege
artis** against every section the reference demands so it can be dropped, as
is, into Solo.io's partner integration intake and the buyer's architecture
review.

---

## 1. Component identity

| Field | Value |
|---|---|
| Component slug | `mamba-nemotron-agw-adapter` |
| Component version | `0.1.0` (semver, MAJOR.MINOR.PATCH) |
| Source crate(s) | `crates/mamba-nemotron`, `crates/mamba-api`, `crates/mamba-types` |
| Distribution artifact | OCI image `ghcr.io/yawningmonsoon/mamba-nemotron-agw-adapter:0.1.0` (cosign-signed) + Helm chart `oci://ghcr.io/yawningmonsoon/charts/mamba-nemotron-agw-adapter` |
| Agent OS slot — primary | **RUN #7 — LLM Gateway** (model adapter sub-component) |
| Agent OS slot — secondary | **RUN #8 — Model Registry** (registers itself + supported Nemotron variants) |
| Decision marker | 🛒+🔧 Phase 1 — partial buy (Solo.io Agentgateway), partial build (this adapter) |
| Phase | Phase 1 — operational on day one of the certified runtime |
| Licence | **BSL 1.1** with 3-year automatic conversion to **Apache 2.0**; `mamba-types` and the public Rust API stay **MIT** |
| Maturity classification | Beta — eligible for paid pilots, not yet eligible for unattended production without design partner support |
| Ownership | Single-owner (`yawningmonsoon`); COE review gate required for capability changes |

The adapter is *not* a standalone agent. It is a governed model-runtime
upstream that a certified agent calls through Solo.io Agentgateway. All
governance attaches to the calling agent's certificate; this component
contributes attestation evidence into that certificate.

---

## 2. Problem statement & buyer wedge

Solo.io Agentgateway today routes to OpenAI, Anthropic Bedrock, Azure OpenAI,
Google Vertex, and a small number of OSS providers via LiteLLM-style shims.
**It has no governed first-class adapter for the NVIDIA Nemotron family**
(Nemotron-4 340B, Nemotron-Mini-4B, Llama-3.1-Nemotron-70B-Instruct). Every
institution that has spent 2024–25 standing up DGX/Spectrum-X capacity has
the same forced choice: either burn budget on hyperscaler API tokens despite
having paid-for on-prem inference, or write their own ungoverned Triton glue
and lose every guarantee the Agent OS framework promises (capability
enforcement, token budgets per LOB, audit trail completeness, model-registry
approval gates).

`mamba-nemotron` already implements the PyO3 ↔ NVIDIA NIM ↔ Triton path. The
adapter wraps that in (a) the wire protocol Agentgateway expects from
upstream providers, (b) the certificate-bearing identity Agent OS demands of
every component touching an LLM call, and (c) the audit/lineage emission
required for Dimension 8 (Auditability) and Dimension 5 (Data Governance) of
the 8-Dimension Evaluation.

Buyer wedge is therefore: **"keep your DGX investment, drop in one Helm
chart, pass your EU AI Act / NIST AI RMF audit on Nemotron the same way you
pass it on Bedrock."**

---

## 3. Architecture

```
                         ┌──────────────────────────────────────────────┐
                         │  Certified Agent (e.g. Underwriting Copilot) │
                         │   running on EKS, framework: Anthropic SDK   │
                         └──────────────────────┬───────────────────────┘
                                                │ 1. LLM call (OpenAI-compatible)
                                                ▼
                ┌────────────────────────────────────────────────────┐
                │           Solo.io Agentgateway (Envoy)             │
                │   - reads Capability Registry (allowed models)     │
                │   - reads Model Registry (approved versions)       │
                │   - enforces token budget per agent + LOB          │
                │   - emits OTel span, structured access log         │
                └──────────────────────┬─────────────────────────────┘
                                       │ 2. upstream HTTP (mTLS, SPIFFE id)
                                       ▼
        ┌──────────────────────────────────────────────────────────────┐
        │      mamba-nemotron-agw-adapter  (this component)            │
        │                                                              │
        │   axum (mamba-api) ── /v1/chat/completions  (OpenAI-compat)  │
        │         │              /v1/completions                       │
        │         │              /v1/embeddings                        │
        │         │              /healthz   /readyz   /metrics         │
        │         ▼                                                    │
        │   Request validator (mamba-types schemas)                    │
        │         │                                                    │
        │         ▼                                                    │
        │   Bedrock-Guardrails-compatible pre-filter                   │
        │         │                                                    │
        │         ▼                                                    │
        │   PyO3 bridge (mamba-nemotron) ──► Triton / NIM endpoint     │
        │         │                                                    │
        │         ▼                                                    │
        │   Post-filter + tool-call extractor                          │
        │         │                                                    │
        │         ▼                                                    │
        │   Audit emitter (mamba-bus → S3 Object Lock writer)          │
        │   Lineage emitter (OpenLineage → Marquez)                    │
        │   Metrics (Prometheus) + traces (OTel) + logs (Loki)         │
        └──────────────────────────────────────────────────────────────┘
                                       │ 3. inference call (gRPC)
                                       ▼
                    ┌───────────────────────────────────────┐
                    │  NVIDIA Triton Inference Server       │
                    │  (in-cluster or DGX SuperPOD bridge)  │
                    └───────────────────────────────────────┘
```

The adapter is deployed as a **Kubernetes Deployment** (not StatefulSet —
inference state lives in Triton, the adapter is stateless) with an OPA
sidecar for capability enforcement (RUN #5) and an OpenTelemetry Collector
sidecar for telemetry shipping. `hostNetwork` is **not** used — traffic
ingresses through Agentgateway and egresses to Triton over the mesh.

---

## 4. Birthing Engine manifest (Agent OS CRD)

Per BUILD #1 (Birthing Engine), every component is registered through a YAML
manifest validated by the admission webhook. The adapter registers itself as
an **infrastructure agent** (a recognized sub-kind in the reference's CRD
schema):

```yaml
apiVersion: agentos.io/v1
kind: Agent
metadata:
  name: mamba-nemotron-agw-adapter
  namespace: agent-runtime
  labels:
    agentos.io/lob: shared-infrastructure
    agentos.io/owner: yawningmonsoon
    agentos.io/phase: phase-1
    agentos.io/decision-marker: buy-plus-build
spec:
  kind: infrastructure
  role: llm-upstream-adapter
  framework:
    name: anthropic-agent-sdk
    version: ">=0.5.0"
    adapter: mamba-api-axum
  knowledgeBases: []        # adapter does not own a KB
  capabilitiesRef:
    name: mamba-nemotron-agw-adapter-capabilities
  promptTemplatesRef: []    # adapter does not author prompts
  modelsRef:
    - name: nemotron-4-340b-instruct
    - name: llama-3.1-nemotron-70b-instruct
    - name: nemotron-mini-4b-instruct
  guardrailsRef:
    bedrockGuardrailId: gr-mamba-nemotron-default
    opaBundleRef: mamba-nemotron-agw-adapter-opa
  evaluation:
    pipelineRef: agentos-8dim-eval-v1
    benchmarkSetRef: mamba-nemotron-bench-v1
  certification:
    requiredScores:
      accuracy: 0.85
      security: 1.00      # zero tolerance on jailbreaks
      infraCompliance: 1.00
      regulatory: 1.00
      dataGovernance: 1.00
      guardrailAdherence: 1.00
      capabilityGovernance: 1.00
      auditability: 1.00
  deployment:
    runtime: eks
    image: ghcr.io/yawningmonsoon/mamba-nemotron-agw-adapter:0.1.0
    imageDigest: sha256:<populated-by-cosign-at-publish>
    helmChart: oci://ghcr.io/yawningmonsoon/charts/mamba-nemotron-agw-adapter
  ipProtection:
    kmsKeyAlias: alias/agentos/mamba-nemotron-adapter
    s3BucketPolicyRef: s3-policy-mamba-nemotron-artifacts
```

The webhook rejects this manifest unless every `*Ref` resolves and the model
registry confirms each model in `modelsRef` is in `Approved` status.

---

## 5. Capability declaration (BUILD #11 — AI Use Case / Capability Registry)

Every external call surface the adapter touches is declared up front. Runtime
OPA enforcement (RUN #5) blocks anything not in this list and writes a
capability-violation event to the audit trail.

```yaml
apiVersion: agentos.io/v1
kind: Capability
metadata:
  name: mamba-nemotron-agw-adapter-capabilities
  namespace: agent-runtime
spec:
  systemConnectors: []        # no SAP/Workday/Guidewire access
  externalAPIs: []            # no internet egress
  tools:
    - kind: triton-inference
      endpoints:
        - "triton-inference.gpu-pool.svc.cluster.local:8001"
      protocols: [grpc]
      auth: spiffe-mtls
      tokenBudgetPerMinute: 0   # not LLM tokens; gated by Triton resource budget
  agentToAgent: []            # adapter is callable; it does not call other agents
  storage:
    - kind: redis
      endpoints: ["redis-session.agent-runtime.svc.cluster.local:6379"]
      scope: session
      retentionSeconds: 3600
    - kind: dynamodb
      tables: ["agentos-llm-call-quotas"]
      scope: per-agent-rate-limit
    - kind: s3
      buckets: ["agentos-audit-immutable", "agentos-lineage-events"]
      mode: write-only
      objectLock: required
  egress:
    - cidr: "internal-only"
      ports: [8001, 8002]     # triton grpc, triton http
  ingress:
    - source: agentgateway
      ports: [8080]
      auth: spiffe-mtls
```

---

## 6. Compliance standards mapping (BUILD #6)

The adapter is mapped, control-by-control, to the regulatory frameworks in
the Compliance Standards Library. This is the table the institution's audit
team will consume.

| Framework | Article / Control | How the adapter satisfies it |
|---|---|---|
| **EU AI Act** | Art. 12 — automatic logging | Every inference call emits an immutable audit event (§12); retention configurable, default 5 years |
| **EU AI Act** | Art. 13 — transparency | OpenAPI spec published; model card returned on `GET /v1/models/:id` |
| **EU AI Act** | Art. 15 — accuracy & robustness | Dimension 1 + Dimension 2 evaluation gates re-run on every release |
| **NIST AI RMF 1.0** | GOVERN-1.1, MEASURE-2.7 | Certificate JSON enumerates measured scores per dimension; revocation supported |
| **NIST AI RMF 1.0** | MANAGE-4.1 | Adaptive Feedback Loop integration (§18) routes corrections to retraining queue |
| **ISO/IEC 42001:2023** | Cl. 8.3 — operational planning | Helm values + this spec form the operational plan; reviewed at each MINOR bump |
| **ISO/IEC 42001:2023** | Cl. 9.1 — monitoring | Observability (§11) emits the metrics required for AI management system reviews |
| **SOC 2** | CC6.1 | mTLS via SPIFFE; KMS encryption at rest |
| **SOC 2** | CC7.2 | Audit trail to S3 Object Lock (WORM) |
| **NAIC Model Bulletin on AI** (US insurance) | §4.2 governance | Certificate references owner, COE approval, evaluation evidence |

LOB-specific supplemental rules (e.g. AIG underwriting authority limits) are
loaded from the Compliance Standards Library DynamoDB table at adapter start
and compiled into the OPA bundle (§7).

---

## 7. Guardrail configuration (BUILD #7)

Two layers, both required, neither optional.

**Layer A — Bedrock-Guardrails-compatible pre-filter.** The adapter exposes a
guardrail config endpoint (`GET /admin/guardrails`) and accepts the same JSON
schema Amazon Bedrock Guardrails publishes. A reference policy ships in the
chart at `charts/values/guardrails-default.json`:

- Denied topics: weapon design, financial fraud advice, PII exfiltration
- Content filters: hate=HIGH, insults=HIGH, sexual=HIGH, violence=HIGH, misconduct=HIGH, prompt-attack=HIGH
- PII detection: anonymize for `EMAIL`, `PHONE`, `SSN`, `CREDIT_DEBIT_CARD_NUMBER`, `IBAN_CODE`; block on `PASSWORD`, `AWS_ACCESS_KEY`, `AWS_SECRET_KEY`
- Word filters: customer-supplied list loaded from ConfigMap `guardrails-wordlist`
- Sensitive-information filter: regex pack from `mamba-types::guardrails::patterns`

**Layer B — OPA bundle for AIG-specific runtime enforcement.** Compiled at
adapter start from the bundle named in `spec.guardrailsRef.opaBundleRef`. A
representative rule:

```rego
package agentos.nemotron.guardrails

import future.keywords.if
import future.keywords.in

default allow := false

# Deny if calling agent's certificate does not list this model as approved
deny[msg] if {
    not input.request.model in input.cert.models
    msg := sprintf("model %q not on certificate %q", [input.request.model, input.cert.id])
}

# Deny if request would exceed per-LOB token budget
deny[msg] if {
    used := data.budgets[input.cert.lob].used_tokens_today
    incoming := input.request.estimated_tokens
    used + incoming > data.budgets[input.cert.lob].daily_token_cap
    msg := sprintf("LOB %q would exceed daily token cap", [input.cert.lob])
}

# Deny if request originates outside the mesh (no SPIFFE id)
deny[msg] if {
    not input.connection.spiffe_id
    msg := "SPIFFE identity required"
}

allow if {
    count(deny) == 0
}
```

Both layers run on every request. A failure on either is logged and the
request returns `403 Forbidden` with a structured error code so the calling
agent can surface it.

**Boundary case testing is mandatory.** A boundary suite of 412 prompts
(jailbreaks, prompt injection, PII smuggling, capability escalation, system
prompt extraction) lives at `tests/guardrails/boundary/`. CI fails on any
single bypass.

---

## 8. 8-Dimension Evaluation plan (BUILD #8)

The adapter ships its own evaluation pipeline as a SageMaker Pipeline JSON
definition at `eval/pipeline.json`. It is invoked on every release candidate
and on a 30-day rolling cadence in production. **Any single FAIL = halt, no
certificate.**

| Dim | What is measured | Tool | Pass criteria |
|---|---|---|---|
| 1. Accuracy & Quality | Benchmark accuracy on `mamba-nemotron-bench-v1` (1,200 Q/A pairs across underwriting, claims, and general reasoning) | LLM-as-judge (Bedrock Claude 3.5 Sonnet) + Ragas for any RAG-mediated calls | ≥ 0.85 mean score; no regression > 0.03 vs previous certified version |
| 2. Security | Garak red-team suite + 412-prompt internal boundary set | Garak v0.10+ | Zero successful jailbreaks; zero PII leaks; zero system-prompt extractions |
| 3. Infrastructure Compliance | Pod spec, IAM role, network policy, KMS config | OPA + Checkov + CDK Nag | All policies pass; image must be cosign-verified; no privileged containers |
| 4. Regulatory Compliance | Mapped controls in §6 | Credo AI GAIA rules engine | All mapped controls evaluate `compliant` |
| 5. Data Governance | OpenLineage event completeness for a 100-call dry run | Marquez completeness check | 100% of calls produce a complete lineage record (input dataset, model version, output artifact) |
| 6. Guardrail Adherence | Boundary test suite (§7) | Internal harness; Lakera Guard cross-check | Zero bypasses |
| 7. Capability Governance | Static analysis of declared vs actual call surface | Custom analyser in `tools/capgov/` (compares Capability CRD with eBPF-traced syscalls) | Exact match; zero undeclared egresses |
| 8. Auditability | Dry-run mission with audit trail completeness validation | Custom validator against S3 Object Lock store | 100% of calls produce an immutable, queryable, signed audit record within 5 seconds |

Evaluation outputs are signed (KMS) and stored in S3 Object Lock as
`evaluation/<component>/<version>/<dimension>/result.json`. The Certification
Service (BUILD #9) consumes those artifacts to mint the certificate.

---

## 9. Certificate JSON schema

Per BUILD #9, the certificate is the immutable record that proves the
adapter passed every gate. It is KMS-signed, written to S3 Object Lock, and
referenced by the calling agent's certificate.

```json
{
  "$schema": "https://schemas.agentos.io/certificate/v1.json",
  "certificateId": "cert-mamba-nemotron-agw-adapter-0.1.0-2026-05-06T20-08-00Z",
  "issued": "2026-05-06T20:08:00Z",
  "issuer": "agentos-coe-certification-service",
  "subject": {
    "componentSlug": "mamba-nemotron-agw-adapter",
    "componentVersion": "0.1.0",
    "imageDigest": "sha256:...",
    "owner": "yawningmonsoon"
  },
  "agentRegistration": {
    "manifestRef": "s3://agentos-manifests/mamba-nemotron-agw-adapter/0.1.0.yaml",
    "manifestSha256": "..."
  },
  "trainingEvidence": {
    "trainingDataCatalogueRef": "glue://agentos/mamba-nemotron-bench-v1/version/3",
    "trainingDataSha256": "...",
    "trainingReportRef": "s3://agentos-training-reports/mamba-nemotron-agw-adapter/0.1.0.pdf"
  },
  "models": [
    {"name": "nemotron-4-340b-instruct", "registryRef": "sagemaker-mr://approved/nemotron-4-340b-instruct/v1"},
    {"name": "llama-3.1-nemotron-70b-instruct", "registryRef": "sagemaker-mr://approved/llama-3.1-nemotron-70b-instruct/v1"},
    {"name": "nemotron-mini-4b-instruct", "registryRef": "sagemaker-mr://approved/nemotron-mini-4b-instruct/v1"}
  ],
  "guardrailConfig": {
    "bedrockGuardrailId": "gr-mamba-nemotron-default",
    "bedrockGuardrailVersion": "DRAFT-2026-05-06",
    "opaBundleSha256": "..."
  },
  "capabilityListRef": "s3://agentos-capability-registry/mamba-nemotron-agw-adapter/0.1.0.yaml",
  "evaluationScores": {
    "accuracy": 0.879,
    "security": 1.000,
    "infraCompliance": 1.000,
    "regulatory": 1.000,
    "dataGovernance": 1.000,
    "guardrailAdherence": 1.000,
    "capabilityGovernance": 1.000,
    "auditability": 1.000
  },
  "evaluationArtifactsRef": "s3://agentos-evaluation-artifacts/mamba-nemotron-agw-adapter/0.1.0/",
  "revocation": {
    "status": "active",
    "revokedAt": null,
    "reason": null
  },
  "signature": {
    "alg": "AWS_KMS_RSA_PSS_SHA_256",
    "keyAlias": "alias/agentos/certification-signing",
    "value": "<base64>"
  }
}
```

Revocation is append-only — original certificates are never deleted from
Object Lock. Agentgateway re-validates the certificate on a 5-minute cadence
and refuses to route to a revoked adapter.

---

## 10. Runtime deployment

**Helm chart** publishes the following resources:

- `Deployment` — 3 replicas default, anti-affinity across AZs, PodDisruptionBudget=2
- `Service` — ClusterIP, port 8080
- `ServiceMonitor` — Prometheus scrape on `/metrics`
- `NetworkPolicy` — ingress only from Agentgateway, egress only to Triton + audit/lineage S3 + Redis + DynamoDB
- `ConfigMap` — Bedrock Guardrails policy JSON
- `Secret` — Triton mTLS client cert (rotated by cert-manager from SPIFFE)
- `OPA Bundle` (Gatekeeper-compatible) — per §7
- `OpenTelemetry Collector` sidecar — per §11

Default resource budget per replica: `cpu: 500m / 2`, `memory: 1Gi / 4Gi`,
no GPU (inference offloaded to Triton). Adapter is intentionally cheap to
scale horizontally; the cost lives in the GPU pool.

Helm values include an `agentos:` block consumed by the admission webhook:

```yaml
agentos:
  certificateRef: cert-mamba-nemotron-agw-adapter-0.1.0-2026-05-06T20-08-00Z
  agentgateway:
    upstreamRef: nemotron-on-prem
    spiffeIdentity: spiffe://agentos.local/ns/agent-runtime/sa/mamba-nemotron-adapter
  audit:
    bucket: agentos-audit-immutable
    bufferSeconds: 1
    maxBufferBytes: 1048576
  lineage:
    marquezUrl: http://marquez.observability.svc.cluster.local:5000
    namespace: agentos.llm-calls
  observability:
    otelCollector: opentelemetry-collector.observability.svc.cluster.local:4317
```

A Solo.io Agentgateway `Upstream` resource pairs with the chart:

```yaml
apiVersion: gateway.solo.io/v1
kind: Upstream
metadata:
  name: nemotron-on-prem
  namespace: gloo-system
spec:
  kube:
    serviceName: mamba-nemotron-agw-adapter
    serviceNamespace: agent-runtime
    servicePort: 8080
  ai:
    provider:
      openaiCompatible:
        baseUrl: "http://mamba-nemotron-agw-adapter.agent-runtime.svc.cluster.local:8080/v1"
        models:
          - nemotron-4-340b-instruct
          - llama-3.1-nemotron-70b-instruct
          - nemotron-mini-4b-instruct
```

That is the full Solo.io integration surface.

---

## 11. Observability (RUN #12)

OpenTelemetry-first, vendor-neutral, per the reference's explicit
preference. CloudWatch is **not** in the path.

**Metrics** (Prometheus, exposed on `/metrics`):

| Metric | Type | Labels | Meaning |
|---|---|---|---|
| `nemotron_adapter_requests_total` | counter | `agent_cert_id, lob, model, status` | Request count |
| `nemotron_adapter_request_duration_seconds` | histogram | `agent_cert_id, lob, model` | E2E latency including Triton |
| `nemotron_adapter_triton_duration_seconds` | histogram | `model` | Pure inference latency |
| `nemotron_adapter_tokens_total` | counter | `agent_cert_id, lob, model, direction={prompt,completion}` | Token accounting for cost attribution |
| `nemotron_adapter_guardrail_blocks_total` | counter | `agent_cert_id, layer={bedrock,opa}, reason` | Guardrail enforcement events |
| `nemotron_adapter_capability_violations_total` | counter | `agent_cert_id, capability` | OPA sidecar block events |
| `nemotron_adapter_audit_emit_failures_total` | counter | `reason` | Audit pipeline health |

**Traces** (OTel): one span per request, attributes include `agentos.cert.id`,
`agentos.lob`, `agentos.model`, `agentos.guardrail.bedrock_id`, propagated
parent context from Agentgateway.

**Logs** (Loki, JSON): structured, one line per request, redacted per
guardrail PII rules. Log schema is published at
`schemas/logs/v1.access.json`.

**Grafana dashboards** ship with the chart at `dashboards/`:
`overview.json`, `cost-per-lob.json`, `guardrail-health.json`,
`triton-saturation.json`. Each dashboard is portable (no CloudWatch panels).

**SLO definitions** (Prometheus rules): see §17.

---

## 12. Immutable audit trail (RUN #11)

Every request emits one audit event, asynchronously, into S3 Object Lock
(WORM compliance mode). The emission is on the request's critical path only
to the extent of buffering in memory; the in-process buffer is bounded
(`maxBufferBytes` in Helm values) and overflow returns `503` rather than
silently dropping.

Bucket layout:

```
s3://agentos-audit-immutable/
  component=mamba-nemotron-agw-adapter/
    version=0.1.0/
      lob=<lob>/
        date=YYYY-MM-DD/
          hour=HH/
            <ulid>.json    (Object Lock retention: 5 years, governance mode disallowed)
```

Event schema:

```json
{
  "$schema": "https://schemas.agentos.io/audit/v1.llm-call.json",
  "eventId": "01HYABC...",
  "timestamp": "2026-05-06T20:08:00.123Z",
  "component": {"slug": "mamba-nemotron-agw-adapter", "version": "0.1.0", "certificateId": "cert-..."},
  "callingAgent": {"certificateId": "cert-underwriting-copilot-1.4.0-...", "lob": "commercial-lines"},
  "request": {
    "model": "nemotron-4-340b-instruct",
    "promptHash": "sha256:...",
    "promptTokens": 1247,
    "guardrailDecision": "allow",
    "spiffeId": "spiffe://agentos.local/ns/agent-runtime/sa/underwriting-copilot"
  },
  "response": {
    "completionHash": "sha256:...",
    "completionTokens": 523,
    "finishReason": "stop",
    "guardrailDecision": "allow"
  },
  "lineage": {"runId": "abc-123", "marquezNamespace": "agentos.llm-calls"},
  "signature": {"alg": "AWS_KMS_RSA_PSS_SHA_256", "keyAlias": "alias/agentos/audit-signing", "value": "<base64>"}
}
```

Athena partitions auto-discover via `MSCK REPAIR TABLE` on a daily
EventBridge schedule. Regulatory export query template lives at
`athena/queries/regulatory-export.sql`.

---

## 13. Data lineage (GOVERN #4)

OpenLineage events emitted to Marquez on every successful call. Run namespace
is `agentos.llm-calls`; job name is the adapter slug; inputs are the prompt
dataset reference (if RAG) and the model registry reference; outputs are the
completion artifact + audit event ULID. Standard OpenLineage `RunEvent` shape
— no custom extensions, so any LineageEvent consumer (Marquez, DataHub,
Atlan, Collibra, Microsoft Purview) ingests it without translation.

---

## 14. Memory & state (RUN #6)

The adapter is **stateless across requests** — no session memory, no
persistent memory. The only state it touches:

- **Quota state** in DynamoDB (`agentos-llm-call-quotas`): per-cert, per-LOB token counters with TTL aligned to budget windows
- **Rate-limit state** in Redis (`redis-session.agent-runtime.svc.cluster.local`): per-cert request rate
- **Guardrail config cache**: in-process, refreshed every 60 seconds from ConfigMap

Calling agents own their own session/persistent memory. The adapter does not
look at it and never receives raw user data outside the prompt window.

---

## 15. Capability enforcement (RUN #5)

OPA sidecar (`open-policy-agent/opa:0.65.0`) loaded with the bundle named in
the manifest. Every egress call from the adapter pod is intercepted by the
sidecar via Envoy ext_authz; an undeclared destination returns `403` and
emits a `nemotron_adapter_capability_violations_total` increment + an audit
event with `reason=undeclared_egress`. Network policy provides a second
enforcement layer at L3/L4.

---

## 16. IP protection (GOVERN #9)

- All artifacts (image, Helm chart, evaluation evidence, certificate) are
  encrypted at rest with KMS key `alias/agentos/mamba-nemotron-adapter`
- S3 bucket policy `s3-policy-mamba-nemotron-artifacts` restricts read to
  the owning LOB IAM role and the Certification Service role
- Image is signed with cosign keyless (Fulcio + Rekor); admission webhook
  verifies signature
- BSL licence terms restrict competitive hosted offerings (the standard MariaDB-style BSL clause)

---

## 17. Failure modes & SLOs

| SLO | Target | Window | Error budget |
|---|---|---|---|
| Availability | 99.9% | 30d rolling | 43m13s |
| P50 adapter latency (excl. Triton) | < 15ms | 30d rolling | — |
| P99 adapter latency (excl. Triton) | < 80ms | 30d rolling | — |
| Audit emission completeness | 100% | per-call (no error budget) | 0 |
| Guardrail bypass rate | 0% | per-call (no error budget) | 0 |

**Failure modes** (and the documented response in each):

1. **Triton unreachable.** Adapter returns `503 model_unavailable`, OTel span tagged, audit event still written (with `response=null, finishReason=upstream_unreachable`). No retry — Agentgateway owns retry semantics.
2. **Audit emit backlog overflow.** Adapter returns `503 audit_buffer_full` and refuses new requests until drained. Auditability is non-negotiable; latency and availability are sacrificed before audit completeness.
3. **Guardrail config refresh fails.** Adapter continues with cached config and emits a `WARN` log + Prometheus alert; if cache is older than 1 hour, requests start failing closed (`503 guardrail_stale`).
4. **OPA sidecar unhealthy.** Pod readiness fails — Service stops routing — Agentgateway sheds load to other adapter replicas or to a fallback model registered in the Model Registry.
5. **Certificate revoked mid-flight.** Agentgateway stops routing within 5 minutes (next certificate refresh); in-flight requests complete; new requests get `403 certificate_revoked` from Agentgateway.

---

## 18. Adaptive Feedback Loop integration (RUN #13)

When a calling agent's Human-in-the-Loop service (RUN #10) records a
correction on a Nemotron-generated output, ServiceNow / Camunda emits a
correction event onto the SQS queue `agentos-corrections`. The adapter
subscribes only to filter for events whose `model` is one of its registered
models, and forwards them to the Training Engine queue
`agentos-training-triggers` with a structured re-evaluation request. COE
review gate (per RUN #13) decides re-evaluation vs re-certification.

The adapter never auto-fine-tunes. It only **proposes** training inputs.

---

## 19. Off-sell packaging — Solo.io co-sell motion

**Listing path:**

1. Open a Solo.io GitHub issue against `solo-io/gloo` titled *"Upstream
   provider: NVIDIA Nemotron via mamba-nemotron-agw-adapter"*, attach this
   spec
2. Submit the `Upstream` resource example (§10) as a contributed example to
   the Solo.io docs repo
3. File for **Solo.io Verified Partner** status (their ISV programme)
4. Co-author a launch blog post: *"Governed Nemotron in Agentgateway"*
5. Joint webinar with Solo.io DevRel for the regulated-institution segment

**Pricing model (proposed):**

- **OSS tier (BSL):** free for non-competitive use, capped at one Triton
  endpoint
- **Enterprise tier:** subscription, per-Triton-endpoint, includes SOC 2
  letter, pen test report, 24/5 support, model registry curation
- **OEM tier (for Solo.io itself):** flat annual fee for the right to bundle
  the adapter into Solo.io Agentgateway distributions, plus rev-share on
  enterprise upsells originated through Solo.io sales

**Co-sell agreement structure:** mutual NDA, mutual-referral commission
(15%), joint solution brief, listing on both vendors' partner pages.

---

## 20. Acceptance criteria for v0.1.0 release

The v0.1.0 release is shippable when **all** of the following are true:

1. Component manifest (§4) admits cleanly through the Birthing Engine webhook in a reference Agent OS cluster
2. Capability CRD (§5) admits cleanly through OPA Gatekeeper
3. All eight evaluation dimensions (§8) pass at the thresholds in §4 — failures halt release
4. Certificate (§9) is minted, KMS-signed, and resolvable from the Agent Registry
5. Solo.io Agentgateway routes a test prompt through to a real Triton endpoint serving `nemotron-mini-4b-instruct` and returns the completion within the §17 SLO
6. The boundary test suite (§7) records zero bypasses
7. Audit events (§12) for that test prompt are queryable via Athena within 5 seconds
8. OpenLineage event (§13) for that test prompt appears in Marquez within 5 seconds
9. SOC 2 Type I letter scope confirmed to cover the build and release pipeline
10. Helm chart and OCI image are cosign-signed and published

Anything short of all ten = pre-release tag (`0.1.0-rc.N`), not GA.

---

## Appendix A — Cross-references to the frozen Agent OS reference

| This spec § | Reference §  | Component name in reference |
|---|---|---|
| 1, 4 | 4.1 #1 | Birthing Engine |
| 1 | 4.1 #2 | Framework Adapter Layer (`mamba-api` axum adapter) |
| 5, 15 | 4.1 #11, 4.2 #5 | Capability Registry, Capability Enforcement |
| 6 | 4.1 #6 | Compliance Standards Library |
| 7 | 4.1 #7 | Guardrail Engine |
| 8 | 4.1 #8, 4.5.1 | Evaluation Framework, 8-Dimension Evaluation |
| 9 | 4.1 #9 | Certification Service |
| 1, 9 | 4.1 #10 | Agent Registry |
| 10 | 4.2 #1, 4.2 #2 | Runtime Engine, Multi-Tenant Provisioning |
| 10 | 4.2 #7 | LLM Gateway (this is the upstream adapter for it) |
| 10 | 4.2 #8 | Model Registry |
| 11 | 4.2 #12 | Observability Dashboard |
| 12 | 4.2 #11 | Immutable Audit Trail |
| 13 | 4.4 #4 | Data Lineage Service |
| 14 | 4.2 #6 | Memory Management Service |
| 16 | 4.4 #9 | IP Protection on Agents |
| 18 | 4.2 #13 | Adaptive Feedback Loop |
| 19 | 4.1 #17 | Partner Gateway (off-sell channel) |
| — | 4.5 | Evolve — patterns extracted from this spec become the template for every subsequent component |

---

*End of specification.*
