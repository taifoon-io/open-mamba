'use client';

import { useEffect, useState } from 'react';

/**
 * Hairline scroll-progress bar pinned to the bottom edge of the sticky nav.
 * Calm green fill (1px → 2px). Honours prefers-reduced-motion by jumping
 * to final position without smoothing.
 */
export function ScrollProgress() {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const h = document.documentElement;
        const total = h.scrollHeight - h.clientHeight;
        const next = total > 0 ? Math.min(100, Math.max(0, (h.scrollTop / total) * 100)) : 0;
        setPct(next);
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      aria-label="Page scroll progress"
      className="absolute bottom-0 left-0 right-0 h-px bg-transparent pointer-events-none"
    >
      <div
        className="h-full bg-accent origin-left"
        style={{ width: `${pct}%`, transition: 'width 80ms linear' }}
      />
    </div>
  );
}
