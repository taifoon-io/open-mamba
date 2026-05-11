import Link from "next/link";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="mt-32 border-t border-text/[0.06]">
      <div className="container-tight grid gap-10 py-14 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-text/60">
            A friendly little task bus for AI agents. Free, MIT, runs on your
            laptop. No accounts, no telemetry, no nonsense.
          </p>
          <div className="mt-5 inline-flex items-center gap-2 font-mono text-[11px] tracking-[0.16em] text-text/45">
            <span className="live-dot" />
            ENGINE_ON_1337
          </div>
        </div>

        <Col title="THE BUS">
          <FLink href="/#what-it-does">What it does</FLink>
          <FLink href="/#install">Install</FLink>
          <FLink href="/#examples">Examples</FLink>
          <FLink href="/showcase">Showcase</FLink>
        </Col>

        <Col title="LEARN">
          <FLink href="/docs">Docs</FLink>
          <FLink href="https://github.com/yawningmonsoon/open-mamba" external>GitHub</FLink>
          <FLink href="https://github.com/yawningmonsoon/open-mamba/discussions" external>Discussions</FLink>
          <FLink href="https://github.com/yawningmonsoon/open-mamba/issues" external>Issues</FLink>
        </Col>

        <Col title="FAMILY">
          <FLink href="https://taifoon.io" external>taifoon.io</FLink>
          <FLink href="https://taifoon.io/os" external>Taifoon OS</FLink>
          <FLink href="https://taifoon.io/products/taifoon-mamba" external>Hosted Pro</FLink>
          <FLink href="https://taifoon.io/products/taifoon-intel" external>taifoon-intel</FLink>
        </Col>
      </div>

      <div className="border-t border-text/[0.06]">
        <div className="container-tight flex flex-col items-start justify-between gap-2 py-5 font-mono text-[11px] tracking-[0.16em] text-text/45 md:flex-row md:items-center">
          <span>© {new Date().getFullYear()} OPEN-MAMBA · MIT_LICENSED</span>
          <span>BUILT_WITH_LOVE · NO_TELEMETRY · NO_ACCOUNTS</span>
        </div>
      </div>
    </footer>
  );
}

function Col({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="font-mono text-[11px] tracking-[0.2em] text-text/45 mb-3.5">{title}</div>
      <ul className="space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

function FLink({ href, external, children }: { href: string; external?: boolean; children: React.ReactNode }) {
  const cls = "text-text/75 hover:text-brand transition-colors";
  if (external) {
    return (
      <li>
        <a href={href} target="_blank" rel="noreferrer" className={cls}>
          {children} <span className="text-text/30">↗</span>
        </a>
      </li>
    );
  }
  return (
    <li>
      <Link href={href} className={cls}>
        {children}
      </Link>
    </li>
  );
}
