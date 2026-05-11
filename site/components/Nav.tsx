import Link from "next/link";
import { Logo } from "./Logo";

export function Nav() {
  const link =
    "px-3 py-1.5 font-mono text-[12px] uppercase tracking-[0.16em] text-text/65 hover:text-brand transition-colors";
  return (
    <header className="sticky top-0 z-50 border-b border-text/[0.06] bg-bg/[0.95] backdrop-blur-md">
      <div className="container-tight flex h-14 items-center gap-6">
        <Logo />

        <nav className="hidden md:flex items-center gap-1">
          <Link href="/#what-it-does" className={link}>WHAT_IT_DOES</Link>
          <Link href="/#install"      className={link}>INSTALL</Link>
          <Link href="/showcase"      className={link}>SHOWCASE</Link>
          <Link href="/docs"          className={link}>DOCS</Link>
          <a
            href="https://github.com/yawningmonsoon/open-mamba"
            target="_blank"
            rel="noreferrer"
            className={link}
          >
            GITHUB ↗
          </a>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <span className="hidden lg:inline-flex items-center gap-1.5 font-mono text-[11px] tracking-[0.18em] text-text/45">
            <span className="live-dot" />
            FREE · MIT
          </span>
          <a
            href="https://github.com/yawningmonsoon/open-mamba#install"
            target="_blank"
            rel="noreferrer"
            className="btn-primary"
          >
            $ GIT_CLONE
          </a>
        </div>
      </div>
    </header>
  );
}
