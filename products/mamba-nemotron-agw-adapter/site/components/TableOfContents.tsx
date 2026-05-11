'use client';

import { useEffect, useState } from 'react';

type Item = { id: string; label: string };
type Props = { items: Item[] };

/**
 * Sticky TOC for long-form pages. Highlights the section currently in view
 * via IntersectionObserver, scrolls smoothly on click (browser default).
 */
export function TableOfContents({ items }: Props) {
  const [active, setActive] = useState<string>(items[0]?.id ?? '');

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return;
    const sections = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => Boolean(el));

    if (sections.length === 0) return;

    const obs = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top that's intersecting
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-20% 0px -70% 0px', threshold: 0 },
    );

    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [items]);

  return (
    <nav aria-label="On this page" className="text-bodySm">
      <p className="eyebrow eyebrow-muted mb-4">Contents</p>
      <ol className="space-y-1.5 list-none border-l border-line pl-4">
        {items.map((i) => {
          const isActive = active === i.id;
          return (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                className={`block py-0.5 transition-colors duration-fast border-l -ml-[17px] pl-4 ${
                  isActive
                    ? 'text-ink border-accent font-semibold'
                    : 'text-inkMuted border-transparent hover:text-inkSoft'
                }`}
              >
                {i.label}
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
