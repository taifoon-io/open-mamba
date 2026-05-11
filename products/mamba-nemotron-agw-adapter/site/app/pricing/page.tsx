import type { Metadata } from 'next';
import { Reveal } from '@/components/Reveal';

export const metadata: Metadata = {
  title: 'Pricing',
  description:
    'Three tiers — open source under BSL, enterprise subscription, and a custom tier for vendors that bundle the adapter into their own runtime.',
};

const tiers = [
  {
    name: 'Open',
    price: 'Free',
    cadence: 'BSL 1.1 · converts to Apache 2.0 on 2029-05-06',
    summary: 'Evaluation, internal use, and non-competitive production.',
    features: [
      'Full source under BSL 1.1',
      'Helm chart + cosign-signed images',
      'Community support via GitHub issues',
      'One Triton endpoint',
    ],
    cta: { label: 'Install', href: '/install' },
    tone: 'default' as const,
  },
  {
    name: 'Enterprise',
    price: 'Subscription',
    cadence: 'Per Triton endpoint · annual',
    summary: 'For regulated institutions running real production load.',
    features: [
      'Everything in Open',
      'SOC 2 Type II letter (Q3 2026)',
      'Independent pen-test report',
      '24/5 support, named contact',
      '99.9% availability SLA',
      'Quarterly signed compliance pack',
      'Model registry curation',
    ],
    cta: { label: 'Contact', href: 'mailto:maciej@t3rn.io?subject=mamba-nemotron-agw-adapter%20Enterprise' },
    tone: 'primary' as const,
  },
  {
    name: 'Custom',
    price: 'Bespoke',
    cadence: 'For runtime vendors and embedders',
    summary: 'Bundle the adapter into your own gateway distribution.',
    features: [
      'Everything in Enterprise',
      'Right to redistribute under your brand',
      'Joint roadmap input',
      'Co-authored solution briefs',
      'Engineering escalation channel',
    ],
    cta: { label: 'Talk to founder', href: 'mailto:maciej@t3rn.io?subject=mamba-nemotron-agw-adapter%20Custom' },
    tone: 'bronze' as const,
  },
];

const matrix = [
  { feature: 'Helm chart + cosign-signed images',     open: true,  ent: true,  cust: true },
  { feature: 'Triton endpoints',                       open: '1',   ent: 'Unlimited', cust: 'Unlimited' },
  { feature: 'Community support',                      open: true,  ent: true,  cust: true },
  { feature: '24/5 support, named contact',            open: false, ent: true,  cust: true },
  { feature: 'Availability SLA',                       open: '—',   ent: '99.9%', cust: 'Custom' },
  { feature: 'SOC 2 Type II letter',                   open: false, ent: true,  cust: true },
  { feature: 'Independent pen-test report',            open: false, ent: true,  cust: true },
  { feature: 'Quarterly signed compliance pack',       open: false, ent: true,  cust: true },
  { feature: 'Model registry curation',                open: false, ent: true,  cust: true },
  { feature: 'Right to redistribute under your brand', open: false, ent: false, cust: true },
  { feature: 'Joint roadmap input',                    open: false, ent: false, cust: true },
];

export default function PricingPage() {
  return (
    <div className="section-y">
      <div className="container">
        <Reveal>
          <p className="eyebrow eyebrow-muted mb-5">Pricing · three honest tiers</p>
          <h1 className="text-h1 max-w-[22ch] mb-5 text-balance">
            Free to try. Paid where it matters.
          </h1>
          <p className="max-w-prose text-body text-inkSoft mb-12 text-pretty">
            Open covers evaluation and internal use under BSL 1.1.
            Enterprise reflects the cost of carrying SOC 2, support
            rotations, and quarterly compliance reporting. Custom is for
            vendors who want to embed the adapter in their own product.
          </p>
        </Reveal>

        {/* Tier cards */}
        <div className="grid gap-6 lg:grid-cols-3">
          {tiers.map((t, i) => (
            <Reveal as="section" key={t.name} delay={i * 80}
              className={`card flex flex-col h-full ${
                t.tone === 'primary' ? 'border-accent ring-1 ring-accent/30 bg-white' :
                t.tone === 'bronze'  ? 'border-bronze/40' : ''
              }`}>
              <header className="mb-4">
                <p className={`eyebrow ${
                  t.tone === 'primary' ? '' :
                  t.tone === 'bronze'  ? 'eyebrow-bronze' : 'eyebrow-muted'
                } mb-2`}>{t.name}</p>
                <p className="font-serif text-h2 text-ink leading-none">{t.price}</p>
                <p className="text-caption text-inkMuted mt-1.5">{t.cadence}</p>
              </header>
              <p className="text-bodySm text-inkSoft mb-5">{t.summary}</p>
              <ul className="space-y-2 mb-7 flex-1">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2 text-bodySm text-inkSoft">
                    <span className={`mt-2 w-1.5 h-1.5 rounded-full shrink-0 ${
                      t.tone === 'bronze' ? 'bg-bronze' : 'bg-accent'
                    }`} aria-hidden />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <a
                href={t.cta.href}
                className={
                  t.tone === 'primary' ? 'btn btn-primary self-start' :
                  t.tone === 'bronze'  ? 'btn btn-bronze self-start' :
                  'btn btn-secondary self-start'
                }
              >
                {t.cta.label}
              </a>
            </Reveal>
          ))}
        </div>

        {/* Matrix */}
        <Reveal>
          <section aria-labelledby="matrix-heading" className="mt-20">
            <h2 id="matrix-heading" className="text-h3 mb-5">Comparison</h2>
            <div className="overflow-x-auto rounded-md border border-lineSoft">
              <table className="w-full text-bodySm">
                <thead>
                  <tr className="bg-paperAlt text-left">
                    <th scope="col" className="font-semibold text-ink py-3 px-4">Feature</th>
                    <th scope="col" className="font-semibold text-ink py-3 px-4 text-center">Open</th>
                    <th scope="col" className="font-semibold text-accent py-3 px-4 text-center">Enterprise</th>
                    <th scope="col" className="font-semibold text-bronze py-3 px-4 text-center">Custom</th>
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={row.feature} className={i % 2 === 1 ? 'bg-paper/50' : ''}>
                      <td className="py-3 px-4 text-inkSoft">{row.feature}</td>
                      <Cell value={row.open} />
                      <Cell value={row.ent} accent />
                      <Cell value={row.cust} bronze />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </Reveal>

        <Reveal>
          <aside className="mt-16 card max-w-prose">
            <p className="eyebrow eyebrow-bronze mb-2">Partner integrations</p>
            <p className="text-bodySm text-inkSoft">
              Built and listed as a Solo.io Verified Partner integration; we
              also work with any OpenAI-compatible gateway. Reach out for the
              current partner-page references and a joint solution brief.
            </p>
          </aside>
        </Reveal>
      </div>
    </div>
  );
}

function Cell({ value, accent = false, bronze = false }: { value: boolean | string; accent?: boolean; bronze?: boolean }) {
  if (value === true) {
    const colour = accent ? 'text-accent' : bronze ? 'text-bronze' : 'text-inkSoft';
    return (
      <td className={`py-3 px-4 text-center ${colour}`} aria-label="included">
        <svg width="16" height="16" viewBox="0 0 16 16" className="inline-block" aria-hidden="true">
          <path d="M3 8.5L6.5 12L13 4.5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </td>
    );
  }
  if (value === false) {
    return <td className="py-3 px-4 text-center text-inkMuted" aria-label="not included">—</td>;
  }
  return <td className="py-3 px-4 text-center font-mono text-bodySm text-inkSoft">{value}</td>;
}
