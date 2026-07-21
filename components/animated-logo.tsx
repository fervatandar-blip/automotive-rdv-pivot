import Image from "next/image";

// Fade + scale-in on load (see .animate-logo-intro / prefers-reduced-motion
// in globals.css). TODO: the current /logo.png is a raster PNG, so this is
// as far as a CSS-only entrance can go -- a true line-drawing/stroke-reveal
// animation needs an SVG trace of the mark (stroke-dasharray/dashoffset),
// which doesn't exist yet. Swap this component's implementation once one
// does; the wrapper/props here can stay the same.
export function AnimatedLogo({
  size = 40,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <div className={`animate-logo-intro ${className}`}>
      <Image
        src="/logo.png"
        alt="RDV"
        width={size}
        height={size}
        className="rounded-lg"
        priority
      />
    </div>
  );
}
