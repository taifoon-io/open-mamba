"use client";

import { useState } from "react";

export function CodeBlock({
  children,
  filename,
  className = "",
  prompt,
}: {
  children: string;
  filename?: string;
  className?: string;
  /** Show a leading `$ ` prompt for shell-style blocks. */
  prompt?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(children).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className={`border border-text/[0.08] bg-surface/50 ${className}`}>
      <div className="flex items-center justify-between border-b border-text/[0.06] bg-text/[0.02] px-4 py-2.5">
        <span className="font-mono text-[11px] tracking-[0.16em] text-text/45">
          {filename ? `[ ${filename} ]` : "[ SHELL ]"}
        </span>
        <button
          onClick={copy}
          className="font-mono text-[11px] tracking-[0.16em] text-text/45 hover:text-brand transition-colors"
        >
          {copied ? "✓ COPIED" : "COPY"}
        </button>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed text-text">
        <code>
          {prompt ? `$ ${children}` : children}
        </code>
      </pre>
    </div>
  );
}
