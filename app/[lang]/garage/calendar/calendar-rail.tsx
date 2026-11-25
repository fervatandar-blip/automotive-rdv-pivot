import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { monthGridDates, shiftMonth } from "@/lib/calendar-grid";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { APP_TIME_ZONE, dateKeyToDisplayDate } from "@/lib/timezone";
import { CLIENT_CARD, CLIENT_SECTION_LABEL, CLIENT_TEXT_LINK } from "@/lib/client-ui";
import { STATUS_DOT } from "./calendar-views";

type D = Dictionary["garageCalendar"];

const NAV = "flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-subtle hover:text-ink";

/**
 * The calendar's left rail (lg and up): a mini month to jump to any date,
 * the team, and what the colours mean. Every link keeps the current view.
 */
export function CalendarRail({
  anchor,
  todayKey,
  busyDays,
  visibleDates,
  dateLocale,
  hrefForDate,
  dayByMechanicHref,
  mechanics,
  currentUserId,
  statusLabels,
  d,
}: {
  anchor: string;
  todayKey: string;
  // Dates in the mini month with at least one live appointment.
  busyDays: ReadonlySet<string>;
  // What the day/week view shows, banded in the mini month (empty for the
  // month and list views, where the whole month is the view).
  visibleDates: readonly string[];
  dateLocale: string;
  hrefForDate: (date: string) => string;
  dayByMechanicHref: string | null;
  mechanics: { id: string; full_name: string }[];
  currentUserId: string;
  statusLabels: Dictionary["common"]["appointmentStatus"];
  d: D;
}) {
  const dates = monthGridDates(anchor);
  const monthKey = anchor.slice(0, 7);
  const visible = new Set(visibleDates);
  const weekday = new Intl.DateTimeFormat(dateLocale, { timeZone: APP_TIME_ZONE, weekday: "narrow" });
  const monthLabel = dateKeyToDisplayDate(`${monthKey}-01`).toLocaleDateString(dateLocale, {
    timeZone: APP_TIME_ZONE,
    month: "long",
    year: "numeric",
  });

  return (
    <aside className="hidden w-64 shrink-0 flex-col gap-4 lg:flex">
      <section aria-label={monthLabel} className={`${CLIENT_CARD} flex flex-col gap-3 p-4`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-bold capitalize tracking-tight text-ink">{monthLabel}</p>
          <div className="flex items-center">
            <Link href={hrefForDate(shiftMonth(anchor, -1))} aria-label={d.previous} className={NAV}>
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link href={hrefForDate(shiftMonth(anchor, 1))} aria-label={d.next} className={NAV}>
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </div>
        <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-muted">
          {dates.slice(0, 7).map((date) => (
            <span key={date} aria-hidden>
              {weekday.format(dateKeyToDisplayDate(date))}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-y-0.5">
          {dates.map((date, index) => {
            const inMonth = date.startsWith(monthKey);
            const isToday = date === todayKey;
            const shown = visible.has(date);
            // The shown range reads as one band per week row.
            const bandStart = shown && (index % 7 === 0 || !visible.has(dates[index - 1]));
            const bandEnd = shown && (index % 7 === 6 || !visible.has(dates[index + 1]));
            return (
              <Link
                key={date}
                href={hrefForDate(date)}
                aria-current={isToday ? "date" : undefined}
                className={`relative flex h-8 items-center justify-center text-xs tabular-nums transition-colors ${
                  shown ? `bg-subtle ${bandStart ? "rounded-l-lg" : ""} ${bandEnd ? "rounded-r-lg" : ""}` : ""
                } ${inMonth ? "text-ink" : "text-ink-muted/50"} hover:text-ink`}
              >
                <span
                  className={`flex h-7 w-7 items-center justify-center rounded-full ${
                    isToday ? "bg-brand-600 font-bold text-white dark:bg-brand-500" : "hover:bg-hairline"
                  } ${date === anchor && !isToday ? "font-bold ring-1 ring-ink" : ""}`}
                >
                  {Number(date.slice(8))}
                </span>
                {busyDays.has(date) && !isToday && (
                  <span aria-hidden className="absolute bottom-0.5 h-1 w-1 rounded-full bg-ink-muted" />
                )}
              </Link>
            );
          })}
        </div>
      </section>

      {mechanics.length > 0 && (
        <section className={`${CLIENT_CARD} flex flex-col gap-3 p-4`}>
          <div className="flex items-center justify-between gap-2">
            <h2 className={CLIENT_SECTION_LABEL}>{d.team}</h2>
            {dayByMechanicHref && (
              <Link href={dayByMechanicHref} className={`${CLIENT_TEXT_LINK} text-xs`}>
                {d.byMechanic}
              </Link>
            )}
          </div>
          <ul className="flex flex-col gap-2.5">
            {mechanics.map((mechanic) => (
              <li key={mechanic.id} className="flex items-center gap-2.5 text-sm">
                <span
                  aria-hidden
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-subtle text-[11px] font-bold text-ink"
                >
                  {mechanic.full_name
                    .split(/\s+/)
                    .filter(Boolean)
                    .slice(0, 2)
                    .map((part) => part[0]?.toUpperCase())
                    .join("") || "?"}
                </span>
                <span className="truncate font-medium text-ink">
                  {mechanic.full_name}
                  {mechanic.id === currentUserId && <span className="font-normal text-ink-muted"> ({d.you})</span>}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={`${CLIENT_CARD} flex flex-col gap-2.5 p-4`}>
        <h2 className={CLIENT_SECTION_LABEL}>{d.legend}</h2>
        <ul className="flex flex-col gap-2 text-sm text-ink-muted">
          {(["confirmed", "pending", "completed", "cancelled"] as const).map((status) => (
            <li key={status} className="flex items-center gap-2.5">
              <span aria-hidden className={`h-3.5 w-1 rounded-full ${STATUS_DOT[status]}`} />
              {statusLabels[status]}
            </li>
          ))}
          <li className="flex items-center gap-2.5">
            <span aria-hidden className="h-3 w-3 rounded-sm border border-amber-300/70 bg-amber-500/15" />
            {d.blocked}
          </li>
          <li className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="h-3 w-3 rounded-sm border border-hairline bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgb(0_0_0/0.12)_2px_4px)] dark:bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgb(255_255_255/0.12)_2px_4px)]"
            />
            {d.closed}
          </li>
        </ul>
      </section>
    </aside>
  );
}
