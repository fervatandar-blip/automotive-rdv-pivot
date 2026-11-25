"use client";

import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import type { AgendaView } from "@/lib/dashboard";

/**
 * Segmented filter pills over panels the server has already rendered, so
 * switching is instant (no round trip). The choice is mirrored into ?view=
 * with replaceState so a refresh -- including the one after a
 * Confirm/Complete server action -- keeps the same tab; the page reads it
 * back as the initial view (and keys this component on it, so a real link
 * to ?view=pending re-selects). Follows the WAI-ARIA tabs pattern: one tab
 * stop, arrow keys move.
 */
export function AgendaTabs({
  label,
  initialView,
  tabs,
  trailing,
}: {
  label: string;
  initialView: AgendaView;
  tabs: { id: AgendaView; label: string; count: number; panel: ReactNode }[];
  // Rendered at the end of the tab row (e.g. a "full calendar" link).
  trailing?: ReactNode;
}) {
  const [active, setActive] = useState<AgendaView>(initialView);
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const baseId = useId();

  function select(view: AgendaView) {
    setActive(view);
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState(null, "", url);
  }

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let next: number | null = null;
    if (event.key === "ArrowRight") next = (index + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next === null) return;
    event.preventDefault();
    select(tabs[next].id);
    tabRefs.current[tabs[next].id]?.focus();
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="max-w-full overflow-x-auto">
          <div
            role="tablist"
            aria-label={label}
            className="inline-flex gap-1 rounded-full border border-hairline bg-subtle p-1"
          >
            {tabs.map((tab, index) => {
              const selected = tab.id === active;
              return (
                <button
                  key={tab.id}
                  ref={(node) => {
                    tabRefs.current[tab.id] = node;
                  }}
                  type="button"
                  role="tab"
                  id={`${baseId}-tab-${tab.id}`}
                  aria-selected={selected}
                  aria-controls={`${baseId}-panel-${tab.id}`}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => select(tab.id)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                  className={`flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 ${
                    selected
                      ? "bg-white text-ink shadow-sm ring-1 ring-hairline dark:bg-zinc-800"
                      : "text-ink-muted hover:text-ink"
                  }`}
                >
                  {tab.label}
                  <span
                    className={`min-w-5 rounded-full px-1.5 text-center text-xs tabular-nums ${
                      selected
                        ? "bg-brand-600 text-white dark:bg-brand-500"
                        : "bg-zinc-200/80 text-ink-muted dark:bg-zinc-800"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
        {trailing}
      </div>

      {tabs.map((tab) => (
        <div
          key={tab.id}
          role="tabpanel"
          id={`${baseId}-panel-${tab.id}`}
          aria-labelledby={`${baseId}-tab-${tab.id}`}
          hidden={tab.id !== active}
          className="flex flex-col gap-3"
        >
          {tab.panel}
        </div>
      ))}
    </div>
  );
}
