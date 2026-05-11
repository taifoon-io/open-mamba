import { CopyButton } from './CopyButton';

type Props = {
  lang?: string;
  filename?: string;
  showCopy?: boolean;
  children: string;
};

/**
 * Restrained code block: paperAlt surface, mono type, optional language
 * label, optional filename, optional copy button. No syntax highlighting in
 * MVP — clarity over noise. Uses tabular spacing for clean alignment.
 */
export function CodeBlock({ lang, filename, showCopy = true, children }: Props) {
  const code = children.replace(/\n$/, '');
  const hasHeader = filename || lang || showCopy;
  return (
    <figure className="not-prose my-6 rounded-sm border border-lineSoft bg-paperAlt dark:bg-dark-alt dark:border-dark-border overflow-hidden">
      {hasHeader && (
        <figcaption className="flex items-center justify-between gap-3 px-3.5 pt-2.5 pb-2 border-b border-lineSoft/60 dark:border-dark-border/60">
          <div className="flex items-center gap-3 min-w-0">
            {filename && (
              <span className="font-mono text-caption text-inkSoft truncate">{filename}</span>
            )}
            {lang && (
              <span className="text-caption uppercase tracking-wider text-inkMuted">{lang}</span>
            )}
          </div>
          {showCopy && <CopyButton value={code} />}
        </figcaption>
      )}
      <pre className="overflow-x-auto p-4 text-code font-mono text-ink dark:text-dark-text leading-relaxed">
        <code>{code}</code>
      </pre>
    </figure>
  );
}
