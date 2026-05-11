import Link from 'next/link';
import { ScrollProgress } from './ScrollProgress';

const links = [
  { href: '/spec', label: 'Spec' },
  { href: '/install', label: 'Install' },
  { href: '/pricing', label: 'Pricing' },
];

export function Nav() {
  return (
    <header className="sticky top-0 z-sticky bg-paper/85 backdrop-blur supports-[backdrop-filter]:bg-paper/70 border-b border-lineSoft dark:bg-dark-page/85 dark:border-dark-border">
      <div className="container flex items-center justify-between h-16">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 group" aria-label="Home">
            <Logo />
            <span className="font-mono text-bodySm text-ink dark:text-dark-text group-hover:text-accent transition-colors duration-fast">
              mamba<span className="text-accent">·</span>nemotron
            </span>
          </Link>
          <span className="hidden sm:inline-flex pill" title="Current release">
            <span className="pill-dot" /> v0.1.0
          </span>
        </div>
        <nav className="flex items-center gap-1 sm:gap-2" aria-label="Primary">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="btn btn-ghost text-bodySm">
              {l.label}
            </Link>
          ))}
          <Link href="/install" className="btn btn-primary ml-1 sm:ml-2">
            Install
          </Link>
        </nav>
      </div>
      <ScrollProgress />
    </header>
  );
}

function Logo() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <rect x="1" y="1" width="20" height="20" rx="4" stroke="currentColor" strokeWidth="1.25" className="text-ink dark:text-dark-text" />
      <circle cx="11" cy="11" r="3.5" fill="#C96442" />
    </svg>
  );
}
