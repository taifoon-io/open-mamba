import type { Metadata } from 'next';
import Link from 'next/link';
import { TableOfContents } from '@/components/TableOfContents';
import { Reveal } from '@/components/Reveal';

export const metadata: Metadata = {
  title: 'Specification',
  description:
    'Component specification for mamba-nemotron-agw-adapter — twenty sections, every Agent OS slot mapped, written for architecture review.',
};

const sections = [
  { id: 'identity',     n: 1,  title: 'Component identity' },
  { id: 'wedge',        n: 2,  title: 'Problem & wedge' },
  { id: 'architecture', n: 3,  title: 'Architecture' },
  { id: 'birthing',     n: 4,  title: 'Birthing manifest' },
  { id: 'capability',   n: 5,  title: 'Capability declaration' },
  { id: 'compliance',   n: 6,  title: 'Compliance mapping' },
  { id: 'guardrails',   n: 7,  title: 'Guardrail configuration' },
  { id: 'evaluation',   n: 8,  title: '8-Dimension evaluation' },
  { id: 'certificate',  n: 9,  title: 'Certificate JSON' },
  { id: 'deployment',   n: 10, title: 'Runtime deployment' },
  { id: 'observability',n: 11, title: 'Observability' },
  { id: 'audit',        n: 12, title: 'Immutable audit trail' },
  { id: 'lineage',      n: 13, title: 'Data lineage' },
  { id: 'memory',       n: 14, title: 'Memory & state' },
  { id: 'enforcement',  n: 15, title: 'Capability enforcement' },
  { id: 'ip',           n: 16, title: 'IP protection' },
  { id: 'slos',         n: 17, title: 'Failure modes & SLOs' },
  { id: 'feedback',     n: 18, title: 'Adaptive feedback loop' },
  { id: 'offsell',      n: 19, title: 'Off-sell packaging' },
  { id: 'acceptance',   n: 20, title: 'Acceptance criteria' },
];

export default function SpecPage() {
  return (
    <div className="section-y">
      <div className="container">
        {/* Page header */}
        <Reveal>
          <p className="eyebrow eyebrow-muted mb-5">Specification · v0.1 draft · 2026-05-06</p>
          <h1 className="text-h1 max-w-[22ch] mb-5 text-balance">
            The component, in twenty sections.
          </h1>
          <p className="max-w-prose text-h4 font-normal text-inkSoft mb-10 text-pretty">
            Written for an architecture-review board. Every section maps to
            a slot in the Agent OS framework reference; appendix A in the
            full Markdown gives the cross-reference table.
          </p>
          <div className="flex flex-wrap items-center gap-3 mb-12">
            <a
              href="https://github.com/yawningmonsoon/open-mamba/blob/main/products/mamba-nemotron-agw-adapter/docs/SPEC.md"
              className="btn btn-primary"
            >
              View full Markdown source
            </a>
            <Link href="/install" className="btn btn-secondary">Install</Link>
          </div>
        </Reveal>

        {/* Two-column layout */}
        <div className="lg:grid lg:grid-cols-12 lg:gap-12">
          {/* Sticky TOC */}
          <aside className="hidden lg:block lg:col-span-3">
            <div className="sticky top-24">
              <TableOfContents items={sections.map((s) => ({ id: s.id, label: `${s.n}. ${s.title}` }))} />
            </div>
          </aside>

          {/* Long-form content */}
          <article className="lg:col-span-9 max-w-proseTechnical">
            {SECTIONS.map((s, i) => (
              <Reveal as="section" key={s.id} id={s.id} className="scroll-mt-24 mb-14" delay={i * 10}>
                <p className="text-eyebrow uppercase text-accent mb-2">§{s.n}</p>
                <h2 className="text-h2 mb-4 text-balance">{s.title}</h2>
                {s.body.map((p, j) => (
                  <p key={j} className="text-body text-inkSoft mb-4 max-w-prose text-pretty">{p}</p>
                ))}
                {s.list && (
                  <ul className="list-disc pl-6 space-y-2 text-body text-inkSoft max-w-prose">
                    {s.list.map((l, k) => <li key={k}>{l}</li>)}
                  </ul>
                )}
              </Reveal>
            ))}

            <div className="rule my-10" />
            <p className="text-bodySm text-inkMuted">
              The Markdown source contains every YAML manifest, OPA Rego
              snippet, JSON schema, and Helm value referenced above.&nbsp;
              <a
                href="https://github.com/yawningmonsoon/open-mamba/blob/main/products/mamba-nemotron-agw-adapter/docs/SPEC.md"
                className="underline decoration-1 underline-offset-4"
              >
                Read it on GitHub
              </a>
              .
            </p>
          </article>
        </div>
      </div>
    </div>
  );
}

type Sec = { id: string; n: number; title: string; body: string[]; list?: string[] };

const SECTIONS: Sec[] = [
  { id: 'identity', n: 1, title: 'Component identity',
    body: [
      'The adapter is registered as an infrastructure agent — slug mamba-nemotron-agw-adapter, version 0.1.0, owned by yawningmonsoon. It maps to RUN #7 (LLM Gateway) of the Agent OS framework as a model-runtime upstream and incidentally registers itself in RUN #8 (Model Registry) for the Nemotron variants it serves.',
      'Distribution is a cosign-signed OCI image and a Helm chart published over OCI. Licence is BSL 1.1 with an automatic conversion to Apache 2.0 on 2029-05-06. The component is classified beta — eligible for paid pilots with design-partner support, not for unattended production.',
    ],
  },
  { id: 'wedge', n: 2, title: 'Problem & wedge',
    body: [
      'Every gateway that proxies LLM calls today (Solo.io Agentgateway, LiteLLM, Portkey, Helicone, Bedrock) routes well to OpenAI, Bedrock, Azure OpenAI, and Vertex. None of them ships a first-class governed adapter for the NVIDIA Nemotron family.',
      'Institutions that bought DGX or Spectrum-X capacity in 2024–25 are forced into a binary: spend hyperscaler tokens despite paid-for on-prem inference, or wire bespoke Triton glue and lose every governance guarantee the framework otherwise gives them. The adapter closes that gap with a single Helm chart.',
    ],
  },
  { id: 'architecture', n: 3, title: 'Architecture',
    body: [
      'The request path is short: caller → gateway → adapter → Triton. The adapter is stateless across requests; rate-limit state lives in Redis, quota state lives in DynamoDB.',
      'The emit path runs asynchronously off the request: an audit event to S3 Object Lock, an OpenLineage RunEvent to Marquez, and OpenTelemetry traces/metrics/logs to a collector. The adapter buffers emits in-process with a hard byte cap and returns 503 rather than dropping events on overflow — auditability is a hard guarantee, latency and availability give before it does.',
    ],
  },
  { id: 'birthing', n: 4, title: 'Birthing manifest',
    body: [
      'The manifest is a Kubernetes CRD of kind Agent that the Birthing Engine admission webhook validates. It references the certificate, the capability CRD, the model registry entries for each Nemotron variant, the guardrail bundle, and the evaluation pipeline.',
      'The webhook rejects the manifest unless every reference resolves. Registration is a pull request — no out-of-band creation paths exist.',
    ],
  },
  { id: 'capability', n: 5, title: 'Capability declaration',
    body: [
      'Every external call surface is declared up front: Triton on gRPC; storage to Redis, DynamoDB, and two S3 buckets in write-only mode with object-lock required; ingress only from the gateway namespace.',
      'The OPA sidecar enforces this at runtime. Anything not on the list returns 403 to the caller and emits a capability_violations metric plus an audit event. There are no exceptions.',
    ],
  },
  { id: 'compliance', n: 6, title: 'Compliance mapping',
    body: [
      'The spec includes a control-by-control table for EU AI Act (Articles 12, 13, 15), NIST AI RMF 1.0 (GOVERN-1.1, MEASURE-2.7, MANAGE-4.1), ISO/IEC 42001:2023 (clauses 8.3 and 9.1), SOC 2 (CC6.1, CC7.2), and the NAIC Model Bulletin §4.2.',
      'Each row identifies the artifact that satisfies it — audit event, lineage record, certificate field, OPA policy, or signed evaluation result.',
    ],
  },
  { id: 'guardrails', n: 7, title: 'Guardrail configuration',
    body: [
      'Two layers, both required. Layer A is a Bedrock-Guardrails-compatible pre/post filter (denied topics, content categories, PII detection, regex packs from mamba-types). Layer B is an OPA Rego bundle for runtime enforcement: certificate-bound model admission, per-LOB token budgets, SPIFFE identity gating.',
      'Boundary-case testing is not optional. A 412-prompt suite covers jailbreaks, prompt injection, PII smuggling, capability escalation, and system-prompt extraction. CI fails on any single bypass.',
    ],
  },
  { id: 'evaluation', n: 8, title: '8-Dimension evaluation',
    body: [
      'Eight dimensions, eight pass criteria, run on every release candidate and on a 30-day rolling cadence in production. Any single FAIL halts release.',
    ],
    list: [
      'Accuracy & Quality — LLM-as-judge on a 1,200-pair benchmark; ≥ 0.85 mean with no regression > 0.03',
      'Security — Garak red-team plus 412-prompt boundary suite; zero successful jailbreaks, PII leaks, or system-prompt extractions',
      'Infrastructure — OPA + Checkov + CDK Nag against pod spec and IAM; cosign-verified images; no privileged containers',
      'Regulatory — Mapped controls evaluate compliant against the Compliance Standards Library',
      'Data Governance — 100% of test calls produce a complete OpenLineage record',
      'Guardrail Adherence — Boundary suite, zero bypasses',
      'Capability Governance — Static analysis of declared vs eBPF-traced call surface; exact match required',
      'Auditability — 100% of calls produce a queryable, signed audit record within five seconds',
    ],
  },
  { id: 'certificate', n: 9, title: 'Certificate JSON',
    body: [
      'The certificate is the immutable record that proves the component passed every gate. It references the manifest, training-data version, models on the registry, guardrail config, capability list, evaluation scores, and KMS-signed evaluation artifacts.',
      'Revocation is append-only — original certificates are never deleted from Object Lock. The gateway re-validates the certificate on a 5-minute cadence and refuses to route to a revoked adapter.',
    ],
  },
  { id: 'deployment', n: 10, title: 'Runtime deployment',
    body: [
      'The Helm chart publishes a Deployment (3 replicas, anti-affinity, PDB), a Service, a ServiceMonitor, a NetworkPolicy, ConfigMaps for guardrail config and OPA bundle, a Secret for Triton mTLS, and an OpenTelemetry collector sidecar.',
      'Resource budget per replica is small (500m CPU / 1 Gi memory request, 2 CPU / 4 Gi limit) — the adapter is intentionally cheap to scale horizontally; the cost of inference lives in the GPU pool.',
    ],
  },
  { id: 'observability', n: 11, title: 'Observability',
    body: [
      'OpenTelemetry-first, vendor-neutral. CloudWatch is deliberately not in the path. Prometheus scrapes /metrics; Grafana dashboards ship with the chart for overview, per-LOB cost attribution, guardrail health, and Triton saturation.',
      'Metrics are labelled by agent_cert_id, lob, model, and status — every dollar of inference is attributable to a calling agent and an LOB.',
    ],
  },
  { id: 'audit', n: 12, title: 'Immutable audit trail',
    body: [
      'One event per request, asynchronously emitted to S3 Object Lock in WORM compliance mode, retention five years, KMS-signed. Bucket layout partitions by component, version, LOB, and date for fast Athena queries.',
      'Regulatory export is a single Athena query against the partition; the result is exported to a signed S3 URL.',
    ],
  },
  { id: 'lineage', n: 13, title: 'Data lineage',
    body: [
      'OpenLineage RunEvents emitted to Marquez on every successful call. Standard event shape — no custom extensions — so DataHub, Atlan, Collibra, or Microsoft Purview ingest the events without translation.',
    ],
  },
  { id: 'memory', n: 14, title: 'Memory & state',
    body: [
      'The adapter is stateless across requests. The only state it owns is quota counters in DynamoDB and rate-limit counters in Redis. Calling agents own their own session/persistent memory; the adapter never sees raw user data outside the prompt window.',
    ],
  },
  { id: 'enforcement', n: 15, title: 'Capability enforcement',
    body: [
      'OPA sidecar via Envoy ext_authz on every egress. Blocked destinations return 403, increment capability_violations_total, and emit an audit event with reason=undeclared_egress. NetworkPolicy provides a second enforcement layer at L3/L4.',
    ],
  },
  { id: 'ip', n: 16, title: 'IP protection',
    body: [
      'All artifacts encrypted at rest with a per-component KMS key. Image signed with cosign keyless (Fulcio + Rekor); the admission webhook verifies the signature. BSL clauses restrict competitive hosted offerings during the licence window.',
    ],
  },
  { id: 'slos', n: 17, title: 'Failure modes & SLOs',
    body: [
      '99.9% availability over a 30-day rolling window. P50 < 15ms / P99 < 80ms for the adapter itself, excluding the Triton call. Audit emission completeness is non-negotiable — there is no error budget for it.',
      'Five named failure modes are documented with explicit responses, including audit-buffer overflow (return 503 rather than drop), guardrail-config staleness (fail closed after 1h), and certificate revocation in flight (gateway sheds within 5 min).',
    ],
  },
  { id: 'feedback', n: 18, title: 'Adaptive feedback loop',
    body: [
      'Human corrections from the upstream Human-in-the-Loop service flow into a corrections queue. The adapter forwards events whose model is one of its registered Nemotron variants to the Training Engine queue with a re-evaluation request.',
      'The adapter never auto-fine-tunes. It proposes training inputs; a centre-of-excellence review gate decides re-evaluation versus re-certification.',
    ],
  },
  { id: 'offsell', n: 19, title: 'Off-sell packaging',
    body: [
      'Three tiers — open-source (BSL), enterprise (subscription, named SLAs, signed compliance pack), and custom (for vendors who want to bundle the adapter into their own runtime distribution). See the pricing page for the current matrix.',
      'The adapter is built and listed as a verified partner integration for OpenAI-compatible gateway runtimes; co-sell motion includes mutual referral, joint solution briefs, and partner-page listings.',
    ],
  },
  { id: 'acceptance', n: 20, title: 'Acceptance criteria',
    body: [
      'Ten gates close the v0.1.0 release: clean manifest admission, clean OPA admission, all eight evaluation thresholds met, certificate minted and resolvable, end-to-end smoke test through the gateway against a real Triton endpoint, audit and lineage events queryable within five seconds, SOC 2 scope confirmed, and signed Helm chart + OCI image published.',
      'Anything short of all ten ships as a pre-release tag (0.1.0-rc.N), not GA.',
    ],
  },
];
