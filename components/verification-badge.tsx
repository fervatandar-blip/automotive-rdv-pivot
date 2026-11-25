import { Award, Shield, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { normalizeVerificationLevel, type VerificationLevel } from "@/lib/verification";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

// Neutral chip with a hairline; only the icon carries the tier's colour, so
// a list of results doesn't turn into a wall of coloured badges.
const LEVEL_STYLE: Record<VerificationLevel, { icon: LucideIcon; className: string }> = {
  basic: { icon: Shield, className: "text-ink-muted" },
  verified: { icon: ShieldCheck, className: "text-emerald-600 dark:text-emerald-400" },
  ev_certified: { icon: Zap, className: "text-sky-600 dark:text-sky-400" },
  trusted_partner: { icon: Award, className: "text-amber-600 dark:text-amber-400" },
};

/**
 * The garage's verification tier as clients see it. The tooltip (and the
 * screen-reader text) says what RDV actually checked for that tier.
 */
export function VerificationBadge({
  level,
  labels,
  className = "",
}: {
  level: string | null | undefined;
  labels: Dictionary["verificationLevels"];
  className?: string;
}) {
  const key = normalizeVerificationLevel(level);
  const { icon: Icon, className: tone } = LEVEL_STYLE[key];
  const { label, description } = labels[key];

  return (
    <span
      title={description}
      className={`inline-flex w-fit items-center gap-1 rounded-full border border-hairline bg-surface px-2.5 py-1 text-xs font-semibold text-ink ${className}`}
    >
      <Icon aria-hidden className={`h-3.5 w-3.5 shrink-0 ${tone}`} strokeWidth={2} />
      {label}
      <span className="sr-only">: {description}</span>
    </span>
  );
}
