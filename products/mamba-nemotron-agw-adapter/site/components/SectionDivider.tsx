type Props = { label?: string; tone?: 'default' | 'subtle' };

/**
 * A typographic section divider — a hairline rule with an optional small
 * caps label centred. Used between major page sections to create rhythm
 * without resorting to coloured backgrounds.
 */
export function SectionDivider({ label, tone = 'default' }: Props) {
  if (!label) {
    return <div role="separator" aria-hidden="true" className="container my-12 md:my-16"><div className="rule" /></div>;
  }
  const colour = tone === 'subtle' ? 'text-inkMuted' : 'text-inkSoft';
  return (
    <div role="separator" aria-label={label} className="container my-16 md:my-20">
      <div className="flex items-center gap-5">
        <div className="rule flex-1" />
        <span className={`text-eyebrow uppercase ${colour}`}>{label}</span>
        <div className="rule flex-1" />
      </div>
    </div>
  );
}
