import { CalendarCheck, Star, Users, type LucideIcon } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type D = Dictionary["garageClients"];

/** The directory's KPI strip: total clients, active this month, VIPs. */
export function DirectoryStats({
  stats,
  d,
}: {
  stats: { total: number; activeThisMonth: number; vip: number };
  d: D;
}) {
  const cards: { label: string; value: number; icon: LucideIcon; accent: string }[] = [
    {
      label: d.kpiTotal,
      value: stats.total,
      icon: Users,
      accent: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300",
    },
    {
      label: d.kpiActiveThisMonth,
      value: stats.activeThisMonth,
      icon: CalendarCheck,
      accent: "bg-green-100 text-green-700 dark:bg-green-500/15 dark:text-green-400",
    },
    {
      label: d.kpiVip,
      value: stats.vip,
      icon: Star,
      accent: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
    },
  ];

  return (
    <dl className="grid grid-cols-3 gap-3">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white p-3 sm:p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
          >
            <span
              aria-hidden
              className={`hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg sm:flex ${card.accent}`}
            >
              <Icon className="h-4 w-4" strokeWidth={2} />
            </span>
            <div className="min-w-0">
              <dt className="truncate text-xs font-medium text-zinc-500 dark:text-zinc-400">{card.label}</dt>
              <dd className="text-xl font-semibold tabular-nums text-black sm:text-2xl dark:text-zinc-50">
                {card.value}
              </dd>
            </div>
          </div>
        );
      })}
    </dl>
  );
}
