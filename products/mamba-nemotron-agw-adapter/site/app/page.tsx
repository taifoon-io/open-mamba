import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { ArchitectureDiagram } from '@/components/ArchitectureDiagram';
import { CodeBlock } from '@/components/CodeBlock';
import { CTA } from '@/components/CTA';
import { Reveal } from '@/components/Reveal';
import { SectionDivider } from '@/components/SectionDivider';

export default function HomePage() {
  return (
    <>
      <Hero />

      <SectionDivider label="What it does" />

      <section className="container">
        <div className="grid gap-10 lg:gap-16 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="eyebrow mb-5">Drop-in upstream</p>
              <h2 className="text-h2 mb-5 text-balance">
                Looks like another OpenAI provider. Behaves like a contract.
              </h2>
            </Reveal>
            <Reveal delay={80}>
              <p className="text-body text-inkSoft mb-4 text-pretty">
                The adapter exposes the OpenAI HTTP surface
                (<code className="font-mono text-bodySm">/v1/chat/completions</code>,
                <code className="font-mono text-bodySm"> /v1/completions</code>,
                <code className="font-mono text-bodySm"> /v1/embeddings</code>),
                so it slots in beside Bedrock or Azure OpenAI as a Solo.io
                Agentgateway upstream &mdash; or behind any other gateway that
                speaks OpenAI&rsquo;s shape.
              </p>
              <p className="text-body text-inkSoft text-pretty">
                Everything else is the contract: an Agent OS certificate
                bound to the request, a model registry that gates which
                Nemotron variants are admissible, a guardrail layer that
                runs before <em>and</em> after inference, and an immutable
                audit record produced before the response leaves the pod.
              </p>
            </Reveal>
          </div>
          <div className="lg:col-span-7">
            <Reveal delay={120}>
              <CodeBlock lang="bash" filename="register the upstream">{`# 1. install the adapter (cosign-signed image, 3 replicas, OPA sidecar)
helm install mamba-nemotron-agw-adapter \\
  oci://ghcr.io/yawningmonsoon/charts/mamba-nemotron-agw-adapter \\
  --version 0.1.0 -n agent-runtime --create-namespace \\
  --set agentos.certificateRef=cert-mamba-nemotron-agw-adapter-0.1.0 \\
  --set triton.endpoint=triton-inference.gpu-pool.svc.cluster.local:8001

# 2. point your gateway at it (Solo.io Upstream shown)
kubectl apply -f - <<'YAML'
apiVersion: gateway.solo.io/v1
kind: Upstream
metadata: { name: nemotron-on-prem, namespace: gloo-system }
spec:
  ai:
    provider:
      openaiCompatible:
        baseUrl: "http://mamba-nemotron-agw-adapter.agent-runtime.svc.cluster.local:8080/v1"
        models: [nemotron-mini-4b-instruct, llama-3.1-nemotron-70b-instruct, nemotron-4-340b-instruct]
YAML`}</CodeBlock>
            </Reveal>
          </div>
        </div>
      </section>

      <SectionDivider label="How it fits" />

      <section className="container">
        <Reveal>
          <p className="eyebrow eyebrow-bronze mb-4">Architecture</p>
          <h2 className="text-h2 max-w-[26ch] text-balance mb-3">
            On the request path. Off it for everything else.
          </h2>
          <p className="max-w-prose text-body text-inkSoft mb-2 text-pretty">
            The adapter sits inline for the actual inference call &mdash; so
            it can pre-validate, gate models, and budget tokens &mdash; and
            emits asynchronously to audit, lineage, and telemetry sinks so
            none of those paths bottleneck inference.
          </p>
        </Reveal>
        <Reveal delay={120}>
          <ArchitectureDiagram />
        </Reveal>
      </section>

      <SectionDivider label="The eight gates" />

      <section className="container">
        <Reveal>
          <p className="eyebrow mb-4">Certification</p>
          <h2 className="text-h2 max-w-[28ch] text-balance mb-4">
            Eight evaluation dimensions. One <em>FAIL</em> halts release.
          </h2>
          <p className="max-w-prose text-body text-inkSoft mb-10 text-pretty">
            Every release is gated by an automated pipeline. The
            certificate that ships with each version cryptographically
            binds the scores below to the running pod &mdash; and the
            calling agent&rsquo;s certificate references it.
          </p>
        </Reveal>

        <ol className="grid gap-3 md:grid-cols-2 lg:grid-cols-4 list-none">
          {DIMENSIONS.map((d, i) => {
            // Tri-tone rhythm: green primary, bronze secondary, ember reserved for Dim 8
            // (Auditability is the dimension this whole product is built around).
            const toneClass =
              i === 7 ? 'text-ember' : i % 2 === 0 ? 'text-accent' : 'text-bronze';
            return (
              <Reveal as="li" key={d.title} delay={i * 40} className="card">
                <p className={`text-eyebrow uppercase ${toneClass} mb-1.5`}>Dim&nbsp;{i + 1}</p>
                <h3 className="text-h4 mb-1.5 text-ink">{d.title}</h3>
                <p className="text-bodySm text-inkSoft">{d.tool}</p>
              </Reveal>
            );
          })}
        </ol>

        <div className="mt-10 text-center">
          <Link href="/spec#section-8" className="btn btn-secondary">
            Read each gate&rsquo;s pass criteria
          </Link>
        </div>
      </section>

      <SectionDivider label="Compliance posture" />

      <section className="container">
        <div className="grid gap-10 lg:grid-cols-12 items-start">
          <div className="lg:col-span-5">
            <Reveal>
              <p className="eyebrow eyebrow-bronze mb-4">Standards</p>
              <h2 className="text-h2 mb-4 text-balance">Mapped, not asserted.</h2>
              <p className="text-body text-inkSoft text-pretty">
                The spec includes a control-by-control table for each
                framework below. An auditor can pull the certificate
                JSON, the audit-trail S3 manifest, and the lineage events
                and verify the controls themselves.
              </p>
            </Reveal>
          </div>
          <div className="lg:col-span-7">
            <Reveal delay={80}>
              <ul className="grid gap-3 sm:grid-cols-2">
                {STANDARDS.map((s) => (
                  <li key={s.name} className="card">
                    <p className="text-h4 mb-1 text-ink">{s.name}</p>
                    <p className="text-bodySm text-inkSoft">{s.note}</p>
                  </li>
                ))}
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <CTA />
    </>
  );
}

const DIMENSIONS = [
  { title: 'Accuracy & Quality',     tool: 'LLM-as-judge on a 1,200-pair benchmark; Ragas for RAG paths' },
  { title: 'Security',               tool: 'Garak + 412-prompt boundary suite; zero bypasses' },
  { title: 'Infrastructure',         tool: 'OPA, Checkov, CDK Nag against pod spec & IAM' },
  { title: 'Regulatory',             tool: 'Mapped controls across EU AI Act, NIST AI RMF, ISO 42001' },
  { title: 'Data Governance',        tool: 'OpenLineage completeness against Marquez' },
  { title: 'Guardrail Adherence',    tool: 'Bedrock Guardrails + OPA, no bypass under any input' },
  { title: 'Capability Governance',  tool: 'Static analysis: declared vs. eBPF-traced call surface' },
  { title: 'Auditability',           tool: 'Dry-run mission against an S3 Object Lock store' },
];

const STANDARDS = [
  { name: 'EU AI Act',         note: 'Articles 12 (logging), 13 (transparency), 15 (accuracy & robustness)' },
  { name: 'NIST AI RMF 1.0',   note: 'GOVERN-1.1, MEASURE-2.7, MANAGE-4.1' },
  { name: 'ISO/IEC 42001:2023', note: 'Clauses 8.3 (operations) and 9.1 (monitoring)' },
  { name: 'SOC 2',             note: 'CC6.1 (mTLS, KMS) and CC7.2 (immutable audit) — Type II in flight' },
  { name: 'NAIC Model Bulletin', note: '§4.2 governance — owner, COE approval, evaluation evidence' },
  { name: 'OpenLineage',       note: 'Standard RunEvent shape; ingests in DataHub, Atlan, Collibra, Purview' },
];
