import {
  addDaysToDateKey,
  dayOfWeekForDateKey,
  minutesIntoDateInAppZone,
} from "@/lib/timezone";

/**
 * Pure date and layout logic for the garage calendar's time grid. Dates are
 * "YYYY-MM-DD" keys in APP_TIME_ZONE (lib/timezone.ts), so nothing here
 * depends on the server's own zone. Weeks start on Monday (Luxembourg).
 */

export const CALENDAR_VIEWS = ["day", "week", "month", "list"] as const;
export type CalendarView = (typeof CALENDAR_VIEWS)[number];

export function parseCalendarView(value: unknown): CalendarView {
  return CALENDAR_VIEWS.find((view) => view === value) ?? "week";
}

export function isDateKey(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function mondayOf(dateKey: string) {
  return addDaysToDateKey(dateKey, -((dayOfWeekForDateKey(dateKey) + 6) % 7));
}

export function weekDates(dateKey: string) {
  const monday = mondayOf(dateKey);
  return Array.from({ length: 7 }, (_, index) => addDaysToDateKey(monday, index));
}

/** 6 full Monday-first weeks covering the month of `dateKey`. */
export function monthGridDates(dateKey: string) {
  const monday = mondayOf(`${dateKey.slice(0, 7)}-01`);
  return Array.from({ length: 42 }, (_, index) => addDaysToDateKey(monday, index));
}

/** The same day-of-month clamp-free step: first of the previous/next month. */
export function shiftMonth(dateKey: string, months: number) {
  const [year, month] = dateKey.split("-").map(Number);
  const index = year * 12 + (month - 1) + months;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}-01`;
}

/** Where the previous / next arrow goes for each view. */
export function navigationTargets(view: CalendarView, dateKey: string) {
  if (view === "day") {
    return { prev: addDaysToDateKey(dateKey, -1), next: addDaysToDateKey(dateKey, 1) };
  }
  if (view === "month") {
    return { prev: shiftMonth(dateKey, -1), next: shiftMonth(dateKey, 1) };
  }
  return { prev: addDaysToDateKey(dateKey, -7), next: addDaysToDateKey(dateKey, 7) };
}

function timeToMinutes(time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * Hours shown on the Y axis: 08:00-18:00 by default, widened to whole hours
 * covering the garage's opening windows and every appointment on screen, so
 * nothing ever falls off the grid.
 */
export function hourRange({
  windows,
  events,
  defaultStart = 8,
  defaultEnd = 18,
}: {
  windows: { start_time: string; end_time: string }[];
  events: { startMin: number; endMin: number }[];
  defaultStart?: number;
  defaultEnd?: number;
}) {
  let start = defaultStart * 60;
  let end = defaultEnd * 60;
  for (const window of windows) {
    start = Math.min(start, timeToMinutes(window.start_time));
    end = Math.max(end, timeToMinutes(window.end_time));
  }
  for (const event of events) {
    start = Math.min(start, event.startMin);
    end = Math.max(end, event.endMin);
  }
  return {
    startHour: Math.max(0, Math.floor(start / 60)),
    endHour: Math.min(24, Math.ceil(end / 60)),
  };
}

/** An appointment's span on one date, in wall-clock minutes (clipped to the day). */
export function minutesOnDate(
  appointment: { start_time: string; end_time: string },
  dateKey: string
) {
  return {
    startMin: minutesIntoDateInAppZone(new Date(appointment.start_time), dateKey),
    endMin: minutesIntoDateInAppZone(new Date(appointment.end_time), dateKey),
  };
}

export type PlacedEvent<T> = T & { column: number; columns: number };

/**
 * Side-by-side layout for overlapping events in one day column (parallel
 * jobs across mechanics, 0037). Events that transitively overlap form a
 * cluster; each takes the first column free at its start, and every event
 * in the cluster shares the cluster's column count, so widths line up.
 * Back-to-back events (one ends when the next starts) don't overlap.
 */
export function layoutDayEvents<T extends { startMin: number; endMin: number }>(
  events: T[]
): PlacedEvent<T>[] {
  const sorted = [...events].sort(
    (a, b) => a.startMin - b.startMin || b.endMin - a.endMin
  );
  const placed: PlacedEvent<T>[] = [];
  let cluster: PlacedEvent<T>[] = [];
  let columnEnds: number[] = [];
  let clusterEnd = -Infinity;

  const closeCluster = () => {
    for (const event of cluster) event.columns = columnEnds.length;
    placed.push(...cluster);
    cluster = [];
    columnEnds = [];
  };

  for (const event of sorted) {
    if (event.startMin >= clusterEnd && cluster.length > 0) closeCluster();
    let column = columnEnds.findIndex((end) => end <= event.startMin);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(event.endMin);
    } else {
      columnEnds[column] = event.endMin;
    }
    cluster.push({ ...event, column, columns: 1 });
    clusterEnd = Math.max(clusterEnd === -Infinity ? event.endMin : clusterEnd, event.endMin);
  }
  if (cluster.length > 0) closeCluster();
  return placed;
}

/**
 * The parts of [rangeStart, rangeEnd) not covered by opening windows, in
 * minutes, for shading closed time on the grid.
 */
export function closedIntervals({
  windows,
  rangeStartMin,
  rangeEndMin,
}: {
  windows: { start_time: string; end_time: string }[];
  rangeStartMin: number;
  rangeEndMin: number;
}) {
  const open = windows
    .map((window) => ({ start: timeToMinutes(window.start_time), end: timeToMinutes(window.end_time) }))
    .filter((window) => window.end > window.start)
    .sort((a, b) => a.start - b.start);

  const closed: { start: number; end: number }[] = [];
  let cursor = rangeStartMin;
  for (const window of open) {
    if (window.start > cursor) closed.push({ start: cursor, end: Math.min(window.start, rangeEndMin) });
    cursor = Math.max(cursor, window.end);
  }
  if (cursor < rangeEndMin) closed.push({ start: cursor, end: rangeEndMin });
  return closed.filter((interval) => interval.end > interval.start);
}

/**
 * Splits appointments into one group per mechanic, in the order given, plus
 * the ones no current mechanic holds: unassigned, or assigned to someone who
 * has since left the team. Those must stay visible somewhere, so they get
 * their own group rather than being dropped.
 */
export function groupByMechanic<T extends { assigned_mechanic_id: string | null }>(
  items: T[],
  mechanicIds: string[]
) {
  const known = new Set(mechanicIds);
  return {
    byMechanic: new Map(
      mechanicIds.map((id) => [id, items.filter((item) => item.assigned_mechanic_id === id)])
    ),
    unassigned: items.filter(
      (item) => !item.assigned_mechanic_id || !known.has(item.assigned_mechanic_id)
    ),
  };
}

export type DayLayout = "mechanic" | "together";

/** By mechanic is the useful default once there's more than one. */
export function parseDayLayout(value: unknown, mechanicCount: number): DayLayout {
  if (mechanicCount === 0) return "together";
  if (value === "mechanic" || value === "together") return value;
  return mechanicCount >= 2 ? "mechanic" : "together";
}

/**
 * Where a dragged job lands: the top edge of the block (pointer position in
 * the column minus where the block was grabbed), converted to minutes,
 * snapped to `snapMinutes` and kept inside the day so the job still fits.
 */
export function dropStartMinutes({
  blockTopPx,
  rangeStartMin,
  hourPx,
  durationMin,
  snapMinutes = 15,
}: {
  blockTopPx: number; // block's top edge relative to the column's top
  rangeStartMin: number;
  hourPx: number;
  durationMin: number;
  snapMinutes?: number;
}) {
  const raw = rangeStartMin + (blockTopPx / hourPx) * 60;
  const snapped = Math.round(raw / snapMinutes) * snapMinutes;
  return Math.min(Math.max(snapped, 0), 24 * 60 - durationMin);
}

export function minutesToTime(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}
