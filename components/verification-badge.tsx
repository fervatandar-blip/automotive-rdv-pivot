import { Award, Shield, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { normalizeVerificationLevel, type VerificationLevel } from "@/lib/verification";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

const LEVEL_STYLE: Record<VerificationLevel, { icon: LucideIcon; className: string }> = {
  basic: {
    icon: Shield,
    className:
      "border-zinc-200 bg-zinc-50 text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300",
  },
  verified: {
    icon: ShieldCheck,
    className:
      "border-green-200 bg-green-50 text-green-800 dark:border-green-900 dark:bg-green-950 dark:text-green-300",
  },
  ev_certified: {
    icon: Zap,
    className:
      "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-300",
  },
  trusted_partner: {
    icon: Award,
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300",
  },
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
      className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${tone} ${className}`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={2} />
      {label}
      <span className="sr-only">: {description}</span>
    </span>
  );
}
