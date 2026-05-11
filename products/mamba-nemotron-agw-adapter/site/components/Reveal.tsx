'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  /** Delay in ms before the element transitions in once it intersects. */
  delay?: number;
  /** Tailwind utility classes for the wrapper. */
  className?: string;
  /** Render as a different element than div. */
  as?: 'div' | 'section' | 'article' | 'li';
  /** Optional DOM id (anchor target). */
  id?: string;
  /** Optional ARIA label. */
  'aria-label'?: string;
};

/**
 * Subtle fade-up on first intersection. No-op under prefers-reduced-motion
 * (the .reveal class collapses to instant via globals.css reduced-motion rule).
 */
export function Reveal({
  children, delay = 0, className = '', as: Tag = 'div', id, ...rest
}: Props) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShown(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            window.setTimeout(() => setShown(true), delay);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    obs.observe(node);
    return () => obs.disconnect();
  }, [delay]);

  return (
    <Tag
      // @ts-expect-error — Tag union covers HTMLElement subtypes
      ref={ref}
      id={id}
      className={`reveal ${shown ? 'reveal-in' : ''} ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}
