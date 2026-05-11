type Variant = 'default' | 'success' | 'warning' | 'danger' | 'info';

const styles: Record<Variant, string> = {
  default: 'bg-paperAlt text-inkSoft border-line',
  success: 'bg-[#E5EFE8] text-success border-[#C8DDD0]',
  warning: 'bg-[#F4ECD7] text-warning border-[#E1D2A8]',
  danger:  'bg-[#F2DBD6] text-danger border-[#E2BCB3]',
  info:    'bg-[#DCE8F0] text-info border-[#BCCDD9]',
};

export function Badge({
  children, variant = 'default',
}: { children: React.ReactNode; variant?: Variant }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-sm border text-caption uppercase tracking-wider ${styles[variant]}`}>
      {children}
    </span>
  );
}
