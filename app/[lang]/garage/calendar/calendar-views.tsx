import Link from "next/link";
import { Ban, CalendarX2 } from "lucide-react";
import type { DaySchedule } from "@/lib/availability";
import {
  closedIntervals,
  layoutDayEvents,
  minutesOnDate,
} from "@/lib/calendar-grid";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { APP_TIME_ZONE, dateKeyInAppZone, dateKeyToDisplayDate, minutesIntoDateInAppZone } from "@/lib/timezone";

type D = Dictionary["garageCalendar"];
type StatusLabels = Dictionary["common"]["appointmentStatus"];

export type CalendarAppointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  repair_stage: string | null;
  assigned_mechanic_id: string | null;
  services: { name: string } | null;
  profiles: { full_name: string } | null;
  // Walk-in customer (0038) when the job isn't for a registered client.
  walk_in: { full_name: string; phone: string | null } | null;
  vehicle: {
    license_plate: string | null;
    model: string | null;
    brands: { name: string } | null;
  } | null;
};

export const HOUR_PX = 64;
const SLOT_MINUTES = 30;

// Solid left accent carries the status; the tint keeps blocks readable in
// both themes. Text always says the status somewhere (drawer, list, title),
// never color alone.
export const EVENT_STYLES: Record<string, string> = {
  confirmed:
    "border-l-green-600 bg-green-50 text-green-950 hover:bg-green-100 dark:border-l-green-500 dark:bg-green-500/10 dark:text-green-50 dark:hover:bg-green-500/20",
  pending:
    "border-l-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-l-amber-400 dark:bg-amber-500/10 dark:text-amber-50 dark:hover:bg-amber-500/20",
  pending_payment:
    "border-l-amber-500 bg-amber-50 text-amber-950 hover:bg-amber-100 dark:border-l-amber-400 dark:bg-amber-500/10 dark:text-amber-50 dark:hover:bg-amber-500/20",
  completed:
    "border-l-zinc-400 bg-zinc-100 text-zinc-700 hover:bg-zinc-200/70 dark:border-l-zinc-500 dark:bg-zinc-800/70 dark:text-zinc-300 dark:hover:bg-zinc-800",
  cancelled:
    "border-l-red-600 bg-red-50 text-red-900 opacity-80 hover:opacity-100 dark:border-l-red-500 dark:bg-red-500/10 dark:text-red-200",
};

export const STATUS_DOT: Record<string, string> = {
  confirmed: "bg-green-600 dark:bg-green-500",
  pending: "bg-amber-500",
  pending_payment: "bg-amber-500",
  completed: "bg-zinc-400 dark:bg-zinc-500",
  cancelled: "bg-red-600 dark:bg-red-500",
};

export function customerName(appointment: CalendarAppointment, d: D) {
  return appointment.profiles?.full_name ?? appointment.walk_in?.full_name ?? d.clientFallback;
}

export function timeFormatter(lang: string) {
  // 24-hour clock in both languages (Luxembourg usage).
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function minutesLabel(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function PlateChip({ plate }: { plate: string }) {
  return (
    <span className="inline-block rounded-[3px] border border-current/30 px-1 font-mono text-[10px] font-semibold uppercase leading-4 tracking-wide">
      {plate}
    </span>
  );
}

/**
 * Day and week views: an hourly grid, one column per day, appointments
 * positioned by start/end and laid out side by side when they overlap
 * (parallel mechanics). Closed hours and blocks are shaded; every future
 * half-hour is a button that opens the new-appointment modal (see
 * SlotBookingSurface). One scroll container for both axes keeps the day
 * header (top) and the hour axis (left) sticky.
 */
export function TimeGrid({
  dates,
  appointments,
  schedule,
  startHour,
  endHour,
  todayKey,
  now,
  lang,
  dateLocale,
  d,
  hrefForAppointment,
  hrefForDay,
  selectedId,
}: {
  dates: string[];
  appointments: CalendarAppointment[];
  schedule: Map<string, DaySchedule>;
  startHour: number;
  endHour: number;
  todayKey: string;
  now: Date;
  lang: string;
  dateLocale: string;
  d: D;
  hrefForAppointment: (id: string) => string;
  hrefForDay: ((date: string) => string) | null;
  selectedId: string | null;
}) {
  const rangeStartMin = startHour * 60;
  const rangeEndMin = endHour * 60;
  const height = (endHour - startHour) * HOUR_PX;
  const yFor = (minutes: number) => ((minutes - rangeStartMin) / 60) * HOUR_PX;
  const formatTime = timeFormatter(lang);
  const weekday = new Intl.DateTimeFormat(dateLocale, { timeZone: APP_TIME_ZONE, weekday: "short" });
  const slotDay = new Intl.DateTimeFormat(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  const nowMin = minutesIntoDateInAppZone(now, todayKey);
  const hours = Array.from({ length: endHour - startHour }, (_, index) => startHour + index);
  const gridColumns = `3.5rem repeat(${dates.length}, minmax(${dates.length > 1 ? "7.5rem" : "0"}, 1fr))`;

  return (
    <div className="max-h-[calc(100dvh-14rem)] min-h-[24rem] overflow-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid" style={{ gridTemplateColumns: gridColumns }}>
        {/* Header row */}
        <div className="sticky left-0 top-0 z-30 border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900" />
        {dates.map((date) => {
          const display = dateKeyToDisplayDate(date);
          const isToday = date === todayKey;
          const content = (
            <>
              <span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                {weekday.format(display)}
              </span>
              <span
                className={`flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold tabular-nums ${
                  isToday
                    ? "bg-brand-600 text-white dark:bg-brand-500"
                    : "text-black dark:text-zinc-50"
                }`}
              >
                {Number(date.slice(8))}
              </span>
            </>
          );
          return (
            <div
              key={date}
              className="sticky top-0 z-20 border-b border-l border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
            >
              {hrefForDay ? (
                <Link
                  href={hrefForDay(date)}
                  aria-current={isToday ? "date" : undefined}
                  className="flex flex-col items-center gap-0.5 py-2 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/60"
                >
                  {content}
                </Link>
              ) : (
                <div className="flex flex-col items-center gap-0.5 py-2">{content}</div>
              )}
            </div>
          );
        })}

        {/* Hour axis */}
        <div className="sticky left-0 z-20 bg-white dark:bg-zinc-900" style={{ height }}>
          {hours.map((hour) => (
            <span
              key={hour}
              className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-zinc-500 first:translate-y-0.5 dark:text-zinc-500"
              style={{ top: yFor(hour * 60) }}
            >
              {minutesLabel(hour * 60)}
            </span>
          ))}
        </div>

        {/* Day columns */}
        {dates.map((date) => {
          const day = schedule.get(date);
          // Clipping to the day (0..1440) leaves an empty span for anything
          // that doesn't touch this date, so one filter covers same-day,
          // overnight and multi-day jobs alike.
          const dayEvents = layoutDayEvents(
            appointments
              .map((appointment) => ({ ...appointment, ...minutesOnDate(appointment, date) }))
              .filter((event) => event.endMin > event.startMin)
          );
          const closed = closedIntervals({
            windows: day?.windows ?? [],
            rangeStartMin,
            rangeEndMin,
          });
          const slots = Array.from(
            { length: (rangeEndMin - rangeStartMin) / SLOT_MINUTES },
            (_, index) => rangeStartMin + index * SLOT_MINUTES
          ).filter((start) => date > todayKey || (date === todayKey && start + SLOT_MINUTES > nowMin));

          return (
            <div
              key={date}
              className="relative border-l border-zinc-200 dark:border-zinc-800"
              style={{ height }}
            >
              {/* Hour and half-hour lines */}
              {hours.map((hour) => (
                <div key={hour} aria-hidden>
                  <div
                    className="absolute inset-x-0 border-t border-zinc-200 dark:border-zinc-800/50"
                    style={{ top: yFor(hour * 60) }}
                  />
                  <div
                    className="absolute inset-x-0 border-t border-dashed border-zinc-100 dark:border-zinc-800/30"
                    style={{ top: yFor(hour * 60 + 30) }}
                  />
                </div>
              ))}

              {/* Closed hours */}
              {closed.map((interval) => (
                <div
                  key={interval.start}
                  aria-hidden
                  className="absolute inset-x-0 bg-[repeating-linear-gradient(135deg,transparent_0_7px,rgb(0_0_0/0.035)_7px_14px)] dark:bg-[repeating-linear-gradient(135deg,transparent_0_7px,rgb(255_255_255/0.025)_7px_14px)]"
                  style={{ top: yFor(interval.start), height: yFor(interval.end) - yFor(interval.start) }}
                />
              ))}

              {/* Bookable half-hours (past ones aren't offered) */}
              {slots.map((start) => {
                const label = minutesLabel(start);
                return (
                  <button
                    key={start}
                    type="button"
                    data-slot-date={date}
                    data-slot-time={label}
                    aria-label={d.newAppointmentAt
                      .replace("{day}", slotDay.format(dateKeyToDisplayDate(date)))
                      .replace("{time}", label)}
                    className="group absolute inset-x-0 z-0 flex items-start px-1.5 pt-0.5 text-left transition-colors hover:bg-brand-500/[.06] focus-visible:bg-brand-500/[.08] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-600/50 dark:hover:bg-zinc-800/60"
                    style={{ top: yFor(start), height: (SLOT_MINUTES / 60) * HOUR_PX }}
                  >
                    <span className="hidden text-[11px] font-medium text-brand-600 group-hover:inline group-focus-visible:inline dark:text-brand-400">
                      + {label}
                    </span>
                  </button>
                );
              })}

              {/* Blocks (0039) */}
              {(day?.blocks ?? []).map((block) => {
                const start = Math.max(minutesIntoDateInAppZone(block.start, date), rangeStartMin);
                const end = Math.min(minutesIntoDateInAppZone(block.end, date), rangeEndMin);
                if (end <= start) return null;
                return (
                  <div
                    key={block.id}
                    className="pointer-events-none absolute inset-x-0 z-[5] overflow-hidden border-y border-amber-300/60 bg-[repeating-linear-gradient(135deg,rgb(245_158_11/0.10)_0_6px,rgb(245_158_11/0.04)_6px_12px)] px-1.5 py-0.5 dark:border-amber-500/30"
                    style={{ top: yFor(start), height: yFor(end) - yFor(start) }}
                  >
                    <span className="flex items-center gap-1 text-[11px] font-medium text-amber-800 dark:text-amber-300">
                      <Ban aria-hidden className="h-3 w-3 shrink-0" />
                      <span className="truncate">{block.reason ? `${d.blocked} · ${block.reason}` : d.blocked}</span>
                    </span>
                  </div>
                );
              })}

              {/* Appointments */}
              {dayEvents.map((event) => {
                const top = yFor(Math.max(event.startMin, rangeStartMin));
                const bottom = yFor(Math.min(event.endMin, rangeEndMin));
                const blockHeight = Math.max(bottom - top, 22);
                const plate = event.vehicle?.license_plate?.trim();
                const service = event.services?.name ?? d.serviceFallback;
                const client = customerName(event, d);
                const range = `${formatTime.format(new Date(event.start_time))}–${formatTime.format(new Date(event.end_time))}`;
                return (
                  <Link
                    key={event.id}
                    href={hrefForAppointment(event.id)}
                    scroll={false}
                    title={`${range} · ${client} · ${service}${plate ? ` · ${plate}` : ""}`}
                    className={`absolute z-10 flex flex-col gap-0.5 overflow-hidden rounded-md border-l-4 px-1.5 py-1 text-left shadow-sm ring-1 ring-black/5 transition-colors dark:ring-white/5 ${
                      EVENT_STYLES[event.status] ?? EVENT_STYLES.pending
                    } ${selectedId === event.id ? "ring-2 ring-brand-600 dark:ring-brand-400" : ""}`}
                    style={{
                      top: top + 1,
                      height: blockHeight - 2,
                      left: `calc(${(event.column / event.columns) * 100}% + 2px)`,
                      width: `calc(${100 / event.columns}% - 4px)`,
                    }}
                  >
                    <span className={`text-[11px] font-semibold tabular-nums leading-tight ${event.status === "cancelled" ? "line-through" : ""}`}>
                      {range}
                    </span>
                    <span className="truncate text-xs font-medium leading-tight">{client}</span>
                    {(plate || service) && (
                      <span className="flex min-w-0 items-center gap-1 text-[11px] leading-tight opacity-80">
                        {plate && <PlateChip plate={plate} />}
                        <span className="truncate">{service}</span>
                      </span>
                    )}
                  </Link>
                );
              })}

              {/* Now */}
              {date === todayKey && nowMin >= rangeStartMin && nowMin <= rangeEndMin && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-20 border-t-2 border-red-500"
                  style={{ top: yFor(nowMin) }}
                >
                  <span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-red-500" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Month view: Monday-first 6-week grid with up to three appointments per day. */
export function MonthGrid({
  dates,
  monthKey,
  appointments,
  todayKey,
  lang,
  dateLocale,
  d,
  hrefForAppointment,
  hrefForDay,
}: {
  dates: string[];
  monthKey: string; // "YYYY-MM"
  appointments: CalendarAppointment[];
  todayKey: string;
  lang: string;
  dateLocale: string;
  d: D;
  hrefForAppointment: (id: string) => string;
  hrefForDay: (date: string) => string;
}) {
  const formatTime = timeFormatter(lang);
  const weekday = new Intl.DateTimeFormat(dateLocale, { timeZone: APP_TIME_ZONE, weekday: "short" });
  const byDay = new Map<string, CalendarAppointment[]>();
  for (const appointment of appointments) {
    const key = dateKeyInAppZone(new Date(appointment.start_time));
    byDay.set(key, [...(byDay.get(key) ?? []), appointment]);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800">
        {dates.slice(0, 7).map((date) => (
          <div
            key={date}
            className="px-2 py-2 text-center text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400"
          >
            {weekday.format(dateKeyToDisplayDate(date))}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {dates.map((date, index) => {
          const inMonth = date.startsWith(monthKey);
          const isToday = date === todayKey;
          const list = byDay.get(date) ?? [];
          const visible = list.slice(0, 3);
          const overflow = list.length - visible.length;
          return (
            <div
              key={date}
              className={`flex min-h-28 min-w-0 flex-col gap-1 border-zinc-200 p-1.5 dark:border-zinc-800 ${
                index % 7 === 0 ? "" : "border-l"
              } ${index >= 7 ? "border-t" : ""} ${inMonth ? "" : "bg-zinc-50/80 dark:bg-zinc-950/40"}`}
            >
              <Link
                href={hrefForDay(date)}
                aria-current={isToday ? "date" : undefined}
                className={`flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-semibold tabular-nums transition-colors ${
                  isToday
                    ? "bg-brand-600 text-white dark:bg-brand-500"
                    : inMonth
                      ? "text-black hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-zinc-800"
                      : "text-zinc-400 hover:bg-zinc-100 dark:text-zinc-600 dark:hover:bg-zinc-800"
                }`}
              >
                {Number(date.slice(8))}
              </Link>
              {visible.map((appointment) => (
                <Link
                  key={appointment.id}
                  href={hrefForAppointment(appointment.id)}
                  scroll={false}
                  className={`flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-[11px] leading-tight transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800 ${
                    appointment.status === "cancelled" ? "text-zinc-400 line-through" : "text-zinc-700 dark:text-zinc-300"
                  }`}
                >
                  <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[appointment.status] ?? STATUS_DOT.pending}`} />
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatTime.format(new Date(appointment.start_time))}
                  </span>
                  <span className="truncate">{customerName(appointment, d)}</span>
                </Link>
              ))}
              {overflow > 0 && (
                <Link
                  href={hrefForDay(date)}
                  className="px-1 text-[11px] font-medium text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {d.moreCount.replace("{count}", String(overflow))}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** List view: the week's appointments, every status, grouped by day. */
export function AppointmentList({
  dates,
  appointments,
  mechanicNames,
  todayKey,
  lang,
  dateLocale,
  d,
  statusLabels,
  hrefForAppointment,
}: {
  dates: string[];
  appointments: CalendarAppointment[];
  mechanicNames: Map<string, string>;
  todayKey: string;
  lang: string;
  dateLocale: string;
  d: D;
  statusLabels: StatusLabels;
  hrefForAppointment: (id: string) => string;
}) {
  const formatTime = timeFormatter(lang);
  const dayLabel = new Intl.DateTimeFormat(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const groups = dates
    .map((date) => ({
      date,
      items: appointments.filter(
        (appointment) => dateKeyInAppZone(new Date(appointment.start_time)) === date
      ),
    }))
    .filter((group) => group.items.length > 0);

  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-white px-6 py-14 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <CalendarX2 aria-hidden className="h-10 w-10 text-zinc-300 dark:text-zinc-700" strokeWidth={1.5} />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.listEmpty}</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {groups.map((group) => (
        <section key={group.date} aria-labelledby={`day-${group.date}`} className="flex flex-col gap-2">
          <h2
            id={`day-${group.date}`}
            className="flex items-center gap-2 text-sm font-semibold text-black first-letter:uppercase dark:text-zinc-50"
          >
            {dayLabel.format(dateKeyToDisplayDate(group.date))}
            {group.date === todayKey && (
              <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[11px] font-medium text-white dark:bg-brand-500">
                {d.today}
              </span>
            )}
          </h2>
          <ul className="divide-y divide-zinc-200 overflow-hidden rounded-xl border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {group.items.map((appointment) => {
              const plate = appointment.vehicle?.license_plate?.trim();
              const mechanic = appointment.assigned_mechanic_id
                ? mechanicNames.get(appointment.assigned_mechanic_id)
                : null;
              return (
                <li key={appointment.id}>
                  <Link
                    href={hrefForAppointment(appointment.id)}
                    scroll={false}
                    className="flex items-center gap-4 px-4 py-3 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <span className={`h-10 w-1 shrink-0 rounded-full ${STATUS_DOT[appointment.status] ?? STATUS_DOT.pending}`} aria-hidden />
                    <span className="w-24 shrink-0 text-sm font-semibold tabular-nums text-black dark:text-zinc-50">
                      {formatTime.format(new Date(appointment.start_time))}
                      <span className="block text-xs font-normal text-zinc-500 dark:text-zinc-400">
                        {formatTime.format(new Date(appointment.end_time))}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-medium text-black dark:text-zinc-50 ${appointment.status === "cancelled" ? "line-through opacity-70" : ""}`}>
                        {appointment.services?.name ?? d.serviceFallback}
                      </span>
                      <span className="flex min-w-0 items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                        <span className="truncate">{customerName(appointment, d)}</span>
                        {plate && <PlateChip plate={plate} />}
                        {mechanic && <span className="hidden truncate sm:inline">· {mechanic}</span>}
                      </span>
                    </span>
                    <span className="hidden shrink-0 text-xs font-medium text-zinc-600 sm:block dark:text-zinc-400">
                      {statusLabels[appointment.status as keyof StatusLabels] ?? appointment.status}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}
