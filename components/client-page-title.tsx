"use client";

import { usePathname } from "next/navigation";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type Labels = Dictionary["clientNav"];

export function ClientPageTitle({ labels }: { labels: Labels }) {
  const pathname = usePathname();
  const [section, detail] = pathname.split("/").filter(Boolean).slice(1);

  // Every client page opens with its own large heading; repeating it in the
  // top bar is clutter. Only a workshop's detail page gets a top-bar title.
  if (section !== "garages" || !detail) return null;

  return <p className="truncate text-base font-semibold text-ink">{labels.garageDetails}</p>;
}
