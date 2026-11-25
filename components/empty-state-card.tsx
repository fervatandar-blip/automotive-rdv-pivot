import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export function EmptyStateCard({
  icon: Icon,
  title,
  description,
  ctaHref,
  ctaLabel,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-hairline bg-surface p-6">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-hairline bg-canvas text-ink-muted">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="font-semibold tracking-tight text-ink">{title}</h3>
        <p className="mt-1 text-sm text-ink-muted">
          {description}
        </p>
      </div>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
