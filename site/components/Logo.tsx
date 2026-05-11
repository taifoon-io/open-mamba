import Link from "next/link";

/**
 * The smiley pixel-snake mamba — open-mamba's signature mark.
 * Mint-green chain (open-mamba is the free cousin), silver head, two pixel
 * eyes, and a 3-pixel smile. Optional blue food pellet.
 *
 * Pure rectangles, `shape-rendering: crispEdges` keeps it sharp at any size.
 */
export function MambaMark({
  size = 28,
  className = "",
  withFood = true,
  smile = true,
}: {
  size?: number;
  className?: string;
  /** Hide the food pellet in tight spaces (favicons, inline). */
  withFood?: boolean;
  /** Hide the smile if the mark must be neutral (rare). */
  smile?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 64 64"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="open-mamba"
      shapeRendering="crispEdges"
    >
      {/* Chain — opacity ladder */}
      <rect x="6"  y="40" width="8" height="8" fill="#34D399" opacity="0.32" />
      <rect x="14" y="40" width="8" height="8" fill="#34D399" opacity="0.5" />
      <rect x="22" y="40" width="8" height="8" fill="#34D399" opacity="0.65" />
      <rect x="22" y="32" width="8" height="8" fill="#34D399" opacity="0.78" />
      <rect x="22" y="24" width="8" height="8" fill="#34D399" opacity="0.9" />
      <rect x="30" y="24" width="8" height="8" fill="#34D399" />
      <rect x="38" y="24" width="8" height="8" fill="#34D399" />
      <rect x="46" y="24" width="8" height="8" fill="#34D399" />
      {/* Silver head */}
      <rect x="46" y="16" width="8" height="8" fill="#E6F0F7" />
      {/* Two friendly eyes */}
      <rect x="48"   y="18" width="1.5" height="1.5" fill="#000" />
      <rect x="51.5" y="18" width="1.5" height="1.5" fill="#000" />
      {/* Smile */}
      {smile && <rect x="49" y="21" width="3" height="1" fill="#000" />}
      {/* Apple */}
      {withFood && (
        <>
          <rect x="10" y="14" width="6" height="6" fill="#3DA5FF" />
          <rect x="12" y="12" width="2" height="2" fill="#34D399" />
        </>
      )}
    </svg>
  );
}

export function Logo({
  size = 26,
  href = "/",
  className = "",
}: {
  size?: number;
  href?: string | null;
  className?: string;
}) {
  const inner = (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <MambaMark size={size} />
      <span className="font-mono text-[13px] font-bold tracking-[0.16em] text-text">
        OPEN<span className="text-brand">-MAMBA</span>
      </span>
    </span>
  );
  if (href === null) return inner;
  return (
    <Link href={href} className="inline-flex">
      {inner}
    </Link>
  );
}
