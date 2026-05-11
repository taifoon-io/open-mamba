type Tone = 'accent' | 'bronze';
type Feature = { title: string; body: string; eyebrow: string; tone: Tone };

const features: Feature[] = [
  {
    tone: 'accent',
    eyebrow: 'Drop-in upstream',
    title: 'One Helm chart, one Solo.io Upstream',
    body: 'OpenAI-compatible API surface (/v1/chat/completions, /v1/completions, /v1/embeddings). Agentgateway routes to it the same way it routes to Bedrock or Azure OpenAI. No glue code in your agents.',
  },
  {
    tone: 'bronze',
    eyebrow: 'Eight-dimension certification',
    title: 'Pass once, ship to production',
    body: 'Every release passes the Agent OS 8-Dimension Evaluation: accuracy, security, infrastructure, regulatory, data governance, guardrails, capability governance, auditability. Any single FAIL halts release.',
  },
  {
    tone: 'accent',
    eyebrow: 'Solo.io native',
    title: 'Built for Agentgateway, certified by Solo.io',
    body: 'Listed Solo.io Verified Partner integration. SPIFFE identity at the mesh edge. Token budgets, cost attribution, and capability enforcement work the way Solo.io customers already expect.',
  },
];

const toneClass: Record<Tone, string> = {
  accent: 'text-accent',
  bronze: 'text-bronze',
};

export function FeatureGrid() {
  return (
    <section className="section-y">
      <div className="container">
        <p className="eyebrow mb-4">Why this exists</p>
        <h2 className="text-h2 max-w-[24ch] text-balance mb-12">
          Three things every regulated buyer asks for, in one component.
        </h2>
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((f) => (
            <article key={f.title} className="card">
              <p className={`text-eyebrow uppercase ${toneClass[f.tone]} mb-3`}>{f.eyebrow}</p>
              <h3 className="text-h4 mb-3 text-ink">{f.title}</h3>
              <p className="text-bodySm text-inkSoft">{f.body}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
