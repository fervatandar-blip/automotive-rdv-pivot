"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

/**
 * Below lg, the dashboard's side panels (today at a glance, team) fold
 * behind one toggle so the agenda stays the first thing on a phone. From lg
 * they sit in the side column and the toggle disappears. Collapsed content
 * is `hidden` (not just visually clipped), so it's also out of the tab order.
 */
export function MobileCollapsible({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <div className={className}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-zinc-200/80 bg-white px-4 py-3 text-left text-sm font-medium text-black transition-colors hover:bg-zinc-50 lg:hidden dark:border-zinc-800/60 dark:bg-transparent dark:text-zinc-50 dark:hover:bg-zinc-900/40"
      >
        {label}
        <ChevronDown
          aria-hidden
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`}
          strokeWidth={2}
        />
      </button>
      <div id={panelId} className={`${open ? "mt-6 flex" : "hidden"} flex-col gap-8 lg:mt-0 lg:flex`}>
        {children}
      </div>
    </div>
  );
}
