import type { Metadata } from 'next';
import Link from 'next/link';
import { CodeBlock } from '@/components/CodeBlock';
import { Reveal } from '@/components/Reveal';

export const metadata: Metadata = {
  title: 'Install',
  description:
    'Install mamba-nemotron-agw-adapter into a Kubernetes cluster fronted by an OpenAI-compatible agent gateway.',
};

export default function InstallPage() {
  return (
    <div className="section-y">
      <div className="container">
        <Reveal>
          <p className="eyebrow eyebrow-muted mb-5">Install · happy path in five steps</p>
          <h1 className="text-h1 max-w-[20ch] mb-5 text-balance">
            One Helm chart. One upstream.
          </h1>
          <p className="max-w-prose text-h4 font-normal text-inkSoft mb-12 text-pretty">
            The adapter is stateless and OpenAI-API-compatible. If you
            already run a gateway and have a Triton endpoint reachable from
            the mesh, you have everything you need.
          </p>
        </Reveal>

        {/* Prerequisites callout */}
        <Reveal>
          <aside aria-label="Prerequisites" className="card max-w-proseTechnical mb-14 border-bronze/30">
            <p className="eyebrow eyebrow-bronze mb-3">Before you start</p>
            <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-2 text-bodySm text-inkSoft">
              <li>Kubernetes ≥ 1.27</li>
              <li>An OpenAI-compatible agent gateway in the cluster</li>
              <li>NVIDIA Triton reachable in-cluster on gRPC :8001</li>
              <li>Agent OS certificate (or dev cert during evaluation)</li>
              <li><code className="font-mono">helm</code> ≥ 3.12</li>
              <li><code className="font-mono">kubectl</code> ≥ 1.27</li>
            </ul>
          </aside>
        </Reveal>

        {/* Steps */}
        <ol className="container-tech list-none p-0 space-y-14">
          <Step n={1} title="Install the chart">
            <p className="text-body text-inkSoft mb-4">
              Pulls the cosign-signed OCI image, deploys 3 replicas with a
              PodDisruptionBudget, NetworkPolicy, OPA sidecar, and OTel scrape
              annotations.
            </p>
            <CodeBlock lang="bash" filename="$ helm install">{`helm install mamba-nemotron-agw-adapter \\
  oci://ghcr.io/yawningmonsoon/charts/mamba-nemotron-agw-adapter \\
  --version 0.1.0 \\
  -n agent-runtime --create-namespace \\
  --set agentos.certificateRef=cert-mamba-nemotron-agw-adapter-0.1.0 \\
  --set triton.endpoint=triton-inference.gpu-pool.svc.cluster.local:8001`}</CodeBlock>
            <Verify lines={[
              'kubectl rollout status deploy/mamba-nemotron-agw-adapter -n agent-runtime',
              'kubectl get pods -n agent-runtime -l app.kubernetes.io/name=mamba-nemotron-agw-adapter',
            ]} expected="3/3 Running, certificate annotation present on Deployment" />
          </Step>

          <Step n={2} title="Register the upstream (Solo.io shown — any OpenAI-compat gateway works)">
            <p className="text-body text-inkSoft mb-4">
              Drop the upstream into your gateway&rsquo;s namespace. With
              Solo.io Agentgateway it&rsquo;s picked up within 30 seconds.
            </p>
            <CodeBlock lang="yaml" filename="upstream.yaml">{`apiVersion: gateway.solo.io/v1
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
          - nemotron-mini-4b-instruct
          - llama-3.1-nemotron-70b-instruct
          - nemotron-4-340b-instruct`}</CodeBlock>
            <CodeBlock lang="bash">{`kubectl apply -f upstream.yaml`}</CodeBlock>
          </Step>

          <Step n={3} title="Smoke-test through the gateway">
            <p className="text-body text-inkSoft mb-4">
              Send any OpenAI-format chat completion to your gateway with
              <code className="font-mono"> model: nemotron-mini-4b-instruct</code>.
              The adapter answers within the §17 SLO.
            </p>
            <CodeBlock lang="bash" filename="$ curl">{`curl -sS https://agentgateway.local/v1/chat/completions \\
  -H 'Authorization: Bearer $AGENT_TOKEN' \\
  -H 'Content-Type: application/json' \\
  -d '{
    "model": "nemotron-mini-4b-instruct",
    "messages": [{"role":"user","content":"Hello from the adapter."}]
  }' | jq`}</CodeBlock>
            <Verify lines={[
              'curl -sS http://mamba-nemotron-agw-adapter.agent-runtime.svc.cluster.local:8080/healthz',
              'curl -sS http://mamba-nemotron-agw-adapter.agent-runtime.svc.cluster.local:8080/metrics | grep nemotron_adapter_requests_total',
            ]} expected="200 from /healthz; nemotron_adapter_requests_total counter increments per call" />
          </Step>

          <Step n={4} title="Verify the governance signals">
            <p className="text-body text-inkSoft mb-3">
              Within five seconds of the smoke test, all four signals below
              should be present.
            </p>
            <ul className="space-y-3 text-body text-inkSoft mb-2">
              <SignalItem label="Audit"     detail="An event in s3://agentos-audit-immutable/component=mamba-nemotron-agw-adapter/… queryable via Athena" />
              <SignalItem label="Lineage"   detail="An OpenLineage RunEvent in Marquez under namespace agentos.llm-calls" />
              <SignalItem label="Metrics"   detail="nemotron_adapter_requests_total increments per call, labelled by agent_cert_id / lob / model / status" />
              <SignalItem label="Traces"    detail="A span per request, parented from the gateway, exported via the OTel collector" />
            </ul>
          </Step>

          <Step n={5} title="Pin the version in your cluster manifests">
            <p className="text-body text-inkSoft mb-3">
              The certificate is bound to a specific image digest. Pin
              <code className="font-mono"> image.digest</code> in your Helm values
              before rolling beyond evaluation, so a re-pull cannot
              substitute an unsigned image.
            </p>
            <CodeBlock lang="yaml" filename="values.production.yaml">{`image:
  repository: ghcr.io/yawningmonsoon/mamba-nemotron-agw-adapter
  tag: "0.1.0"
  digest: "sha256:<from-cosign-verify-output>"

agentos:
  certificateRef: cert-mamba-nemotron-agw-adapter-0.1.0`}</CodeBlock>
          </Step>
        </ol>

        {/* Uninstall */}
        <div className="container-tech mt-16">
          <h2 className="text-h3 mb-3">Uninstall</h2>
          <CodeBlock lang="bash">{`kubectl delete -f upstream.yaml
helm uninstall mamba-nemotron-agw-adapter -n agent-runtime`}</CodeBlock>
          <p className="text-bodySm text-inkMuted">
            Audit data in S3 Object Lock and lineage data in Marquez persist
            independently. Uninstalling does not, and cannot, remove either.
          </p>
        </div>

        <div className="mt-14 flex flex-wrap gap-3">
          <Link href="/spec" className="btn btn-primary">Read the spec</Link>
          <Link href="/pricing" className="btn btn-secondary">Pricing</Link>
        </div>
      </div>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <Reveal as="li" className="grid grid-cols-[3rem_1fr] gap-4">
      <div className="pt-1">
        <span
          aria-hidden="true"
          className="inline-flex items-center justify-center w-9 h-9 rounded-full border border-accent text-accent font-mono text-bodySm"
        >
          {n}
        </span>
      </div>
      <div>
        <h2 className="text-h3 mb-2 text-ink">{title}</h2>
        {children}
      </div>
    </Reveal>
  );
}

function Verify({ lines, expected }: { lines: string[]; expected: string }) {
  return (
    <div className="mt-3 border-l-2 border-success pl-4 py-1">
      <p className="text-eyebrow uppercase text-success mb-1">Verify</p>
      {lines.map((l, i) => (
        <p key={i} className="font-mono text-code text-inkSoft mb-0.5">
          <span className="text-inkMuted">$ </span>{l}
        </p>
      ))}
      <p className="text-bodySm text-inkSoft mt-2"><span className="text-inkMuted">Expect:</span> {expected}</p>
    </div>
  );
}

function SignalItem({ label, detail }: { label: string; detail: string }) {
  return (
    <li className="flex gap-3">
      <span className="text-eyebrow uppercase text-accent w-20 shrink-0 mt-1">{label}</span>
      <span className="text-bodySm">{detail}</span>
    </li>
  );
}
