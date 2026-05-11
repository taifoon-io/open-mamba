'use client';

import { useState, useCallback } from 'react';

type Props = {
  value: string;
  ariaLabel?: string;
  className?: string;
};

/**
 * Copy-to-clipboard button. Lives inside CodeBlock; can be used standalone.
 * Falls back gracefully when navigator.clipboard is unavailable.
 */
export function CopyButton({ value, ariaLabel = 'Copy', className = '' }: Props) {
  const [state, setState] = useState<'idle' | 'copied' | 'error'>('idle');

  const onCopy = useCallback(async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback: deprecated but works on http origins / older browsers
        const ta = document.createElement('textarea');
        ta.value = value;
        ta.setAttribute('readonly', '');
        ta.style.position = 'absolute';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
      }
      setState('copied');
      setTimeout(() => setState('idle'), 1600);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 1800);
    }
  }, [value]);

  const label = state === 'copied' ? 'Copied' : state === 'error' ? 'Try again' : 'Copy';

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={ariaLabel}
      data-state={state}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-sm text-caption font-mono uppercase tracking-wider
        text-inkMuted border border-line bg-paper/60 hover:bg-paperAlt hover:text-ink
        transition-colors duration-fast ${className}`}
    >
      <Icon state={state} />
      <span>{label}</span>
    </button>
  );
}

function Icon({ state }: { state: 'idle' | 'copied' | 'error' }) {
  if (state === 'copied') {
    return (
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
        <path d="M2 6.5L4.75 9L10 3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <rect x="3.5" y="3.5" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1" />
      <path d="M2 8V2.5C2 2.22 2.22 2 2.5 2H8" stroke="currentColor" strokeWidth="1" strokeLinecap="round" />
    </svg>
  );
}
