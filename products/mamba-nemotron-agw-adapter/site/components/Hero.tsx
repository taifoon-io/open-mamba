import Link from 'next/link';
import { Reveal } from './Reveal';

export function Hero() {
  return (
    <section className="relative section-y border-b border-lineSoft dark:border-dark-border overflow-hidden">
      {/* Background hairlines — quiet editorial detail */}
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-60">
        <div className="container h-full">
          <div className="grid grid-cols-12 h-full gap-0">
            {Array.from({ length: 13 }).map((_, i) => (
              <div key={i} className="border-l border-lineSoft last:border-r" />
            ))}
          </div>
        </div>
      </div>

      <div className="container relative">
        <Reveal>
          <p className="eyebrow mb-6">v0.1.0 · beta · Agent OS · RUN #7</p>
        </Reveal>
        <Reveal delay={60}>
          <h1 className="font-serif text-display max-w-[15ch] mb-7 text-balance">
            Nemotron, governed.
          </h1>
        </Reveal>
        <Reveal delay={120}>
          <p className="max-w-prose text-h4 font-normal text-inkSoft dark:text-dark-textSoft mb-9">
            An OpenAI-compatible upstream that keeps NVIDIA Nemotron behind a
            certificate, an audit trail, a capability boundary, and a token
            budget &mdash; without rewriting your agents.
          </p>
        </Reveal>
        <Reveal delay={180}>
          <div className="flex flex-wrap items-center gap-3">
            <Link href="/install" className="btn btn-primary">Install</Link>
            <Link href="/spec" className="btn btn-secondary">Read the spec</Link>
            <Link href="/pricing" className="btn btn-ghost">Pricing</Link>
          </div>
        </Reveal>

        <Reveal delay={260}>
          <dl className="mt-14 grid grid-cols-2 sm:grid-cols-4 gap-y-6 gap-x-8 max-w-3xl">
            <Stat value="3" unit="Nemotron variants" detail="4B mini · 70B Llama · 340B" />
            <Stat value="8" unit="evaluation dimensions" detail="One FAIL halts release" />
            <Stat value="< 80ms" unit="P99 adapter latency" detail="excluding Triton" />
            <Stat value="WORM" unit="audit trail" detail="S3 Object Lock · 5-year retention" />
          </dl>
        </Reveal>
      </div>
    </section>
  );
}

function Stat({ value, unit, detail }: { value: string; unit: string; detail: string }) {
  return (
    <div>
      <dt className="sr-only">{unit}</dt>
      <dd>
        <p className="font-serif text-h2 text-ink leading-none">{value}</p>
        <p className="mt-1.5 text-caption uppercase tracking-wider text-inkMuted">{unit}</p>
        <p className="mt-0.5 text-caption text-inkMuted">{detail}</p>
      </dd>
    </div>
  );
}
