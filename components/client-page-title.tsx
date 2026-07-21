"use client";

import { usePathname } from "next/navigation";

const TITLES: Record<string, string> = {
  dashboard: "My Dashboard",
  garages: "Find a Garage",
  vehicles: "Vehicles",
  account: "Account",
};

export function ClientPageTitle() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean).slice(1);
  const [section, detail] = segments;

  const title =
    section === "garages" && detail
      ? "Garage Details"
      : TITLES[section] ?? "RDV";

  return (
    <h1 className="text-lg font-semibold text-black dark:text-zinc-50">
      {title}
    </h1>
  );
}
