import Link from 'next/link';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-lineSoft dark:border-dark-border mt-24">
      <div className="container py-14 grid gap-10 md:grid-cols-12">
        <div className="md:col-span-5">
          <p className="font-mono text-bodySm text-ink dark:text-dark-text">
            mamba<span className="text-accent">·</span>nemotron-agw-adapter
          </p>
          <p className="mt-3 text-bodySm text-inkSoft max-w-prose">
            A governed NVIDIA Nemotron upstream provider for OpenAI-compatible
            agent runtimes. Part of the Agent OS framework.
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="pill"><span className="pill-dot" /> v0.1.0 · beta</span>
            <span className="pill" title="Live deployment">
              <span className="pill-dot" /> mamba.taifoon.dev
            </span>
          </div>
        </div>

        <div className="md:col-span-2">
          <h4 className="text-eyebrow uppercase text-inkMuted mb-3">Product</h4>
          <ul className="space-y-2 text-bodySm">
            <li><Link href="/spec" className="text-inkSoft hover:text-accent">Specification</Link></li>
            <li><Link href="/install" className="text-inkSoft hover:text-accent">Install</Link></li>
            <li><Link href="/pricing" className="text-inkSoft hover:text-accent">Pricing</Link></li>
          </ul>
        </div>

        <div className="md:col-span-2">
          <h4 className="text-eyebrow uppercase text-inkMuted mb-3">Project</h4>
          <ul className="space-y-2 text-bodySm">
            <li><a href="https://github.com/yawningmonsoon/open-mamba" className="text-inkSoft hover:text-accent">Source</a></li>
            <li><a href="mailto:maciej@t3rn.io" className="text-inkSoft hover:text-accent">Contact</a></li>
          </ul>
        </div>

        <div className="md:col-span-3">
          <h4 className="text-eyebrow uppercase text-inkMuted mb-3">Compliance</h4>
          <ul className="space-y-2 text-bodySm text-inkSoft">
            <li>EU AI Act (logging, transparency, accuracy)</li>
            <li>NIST AI RMF 1.0</li>
            <li>ISO/IEC 42001:2023</li>
            <li>SOC 2 Type II — in flight</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-lineSoft dark:border-dark-border">
        <div className="container py-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-caption text-inkMuted">
          <p>© {year} yawningmonsoon · BSL 1.1, converts to Apache&nbsp;2.0 on 2029-05-06</p>
          <p className="font-mono">Built for the Agent OS framework</p>
        </div>
      </div>
    </footer>
  );
}
