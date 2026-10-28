/**
 * Weekly opening hours, derived from the `availability` table -- the same
 * rows booking slots are computed from (lib/availability.ts), so what a
 * garage's profile shows is exactly when it can be booked. Date-specific
 * overrides (holidays, one-off closures) aren't part of the weekly summary.
 */

export type AvailabilityWindowRow = {
  day_of_week: number; // 0 = Sunday ... 6 = Saturday
  start_time: string; // "HH:MM:SS" or "HH:MM"
  end_time: string;
};

export type DayHours = {
  dayOfWeek: number;
  ranges: string[]; // e.g. ["08:00–12:00", "13:00–18:00"]; empty = closed
};

// Monday-first, as calendars are read in Luxembourg/BE/FR/DE.
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

function hhmm(time: string) {
  return time.slice(0, 5);
}

export function summarizeWeeklyHours(windows: AvailabilityWindowRow[]): DayHours[] {
  return WEEK_ORDER.map((dayOfWeek) => ({
    dayOfWeek,
    ranges: windows
      .filter((window) => window.day_of_week === dayOfWeek)
      .map((window) => ({ start: hhmm(window.start_time), end: hhmm(window.end_time) }))
      .sort((a, b) => a.start.localeCompare(b.start))
      .map(({ start, end }) => `${start}–${end}`),
  }));
}

export function hasAnyOpeningHours(week: DayHours[]) {
  return week.some((day) => day.ranges.length > 0);
}
