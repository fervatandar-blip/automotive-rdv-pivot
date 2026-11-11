"use client";

import { usePathname } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Labels = Dictionary["clientNav"];

export function ClientPageTitle({ labels }: { labels: Labels }) {
  const pathname = usePathname();
  const [section, detail] = pathname.split("/").filter(Boolean).slice(1);

  const titles: Record<string, string> = {
    dashboard: labels.dashboard,
    garages: labels.findGarage,
    vehicles: labels.vehicles,
    account: labels.account,
  };
  const title = section === "garages" && detail ? labels.garageDetails : titles[section] ?? "RDV";

  return <p className="truncate text-base font-semibold text-black dark:text-zinc-50">{title}</p>;
}
