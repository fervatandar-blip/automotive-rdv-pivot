/**
 * The RDV badge: the logo's roofline and speed lines (public/logo.png),
 * redrawn as crisp vector strokes on a rounded square so it stays sharp at
 * sidebar sizes where the raster logo's lettering can't be read. Follows the
 * theme: ink square, surface strokes.
 */
export function BrandMark({
  size = 32,
  className = "",
  inverted = false,
}: {
  size?: number;
  className?: string;
  // White badge with dark strokes, for always-dark surfaces.
  inverted?: boolean;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden
      className={`shrink-0 ${inverted ? "text-white" : "text-ink"} ${className}`}
    >
      <rect width="32" height="32" rx="9" fill="currentColor" />
      <g fill="none" stroke={inverted ? "#18181b" : "var(--surface)"} strokeLinecap="round" strokeLinejoin="round">
        {/* Beltline curling under the nose, then the roof arc. */}
        <path d="M26.2 13.6 12.4 14.4C8.2 14.7 5.6 16 6 17.9c.3 1.2 1.4 1.8 2.8 1.8" strokeWidth="1.8" />
        <path d="M11 14.3c2.2-2.3 4.9-3.5 7.9-3.5 2.6 0 4.8.9 6.6 2.5" strokeWidth="1.8" />
        {/* Speed lines. */}
        <path d="M17.6 17.6h8M15.8 20.6h8M14 23.6h8" strokeWidth="1.6" />
      </g>
    </svg>
  );
}

/** Badge plus the bold "RDV" wordmark. */
export function BrandLogo({ size = 32, inverted = false }: { size?: number; inverted?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <BrandMark size={size} inverted={inverted} />
      <span
        className={`font-display text-xl font-bold leading-none tracking-tight ${inverted ? "text-white" : "text-ink"}`}
      >
        RDV
      </span>
    </span>
  );
}

/**
 * The badge's three speed lines blown up into a livery stripe: same
 * proportions as the logo (bar 1.6, pitch 3, each line starting 1.8 further
 * left than the one above, round caps), running off to the right. Size it
 * with --stripe-bar (bar thickness) and position it (absolute or relative)
 * through className; it takes the text colour, and the parent clips the
 * overflow.
 */
export function SpeedStripe({ className = "" }: { className?: string }) {
  return (
    <div
      aria-hidden
      // No position class of its own: callers place it (absolute, usually).
      className={`pointer-events-none h-[calc(var(--stripe-bar)*4.75)] ${className}`}
    >
      {[0, 1, 2].map((line) => (
        <span
          key={line}
          className="absolute right-0 h-[var(--stripe-bar)] rounded-l-full bg-current"
          style={{
            top: `calc(var(--stripe-bar) * ${line * 1.875})`,
            left: `calc(var(--stripe-bar) * ${(2 - line) * 1.125})`,
          }}
        />
      ))}
    </div>
  );
}
