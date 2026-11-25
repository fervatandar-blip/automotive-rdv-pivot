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
    <div className="flex flex-col items-start gap-3 rounded-xl border border-zinc-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.03)] dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:shadow-none">
      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Icon className="h-5 w-5" strokeWidth={1.5} />
      </div>
      <div>
        <h3 className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">{title}</h3>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {description}
        </p>
      </div>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}
