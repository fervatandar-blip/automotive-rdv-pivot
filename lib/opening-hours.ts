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

/**
 * One row of the "Working hours" form: open or closed, opening hours, and
 * an optional lunch break -- stored as one window (no break) or two
 * (morning + afternoon) in `availability`.
 */
export type DayForm = {
  dayOfWeek: number;
  open: boolean;
  opens: string; // "HH:MM"
  closes: string;
  lunch: boolean;
  lunchStart: string;
  lunchEnd: string;
  // The day currently has more time ranges than the form can show (3+);
  // saving replaces them with what the form shows.
  extraRanges: boolean;
};

export type DayFormError = "invalidTime" | "closeBeforeOpen" | "lunchOutsideHours";

const DEFAULT_DAY = { opens: "08:00", closes: "18:00", lunchStart: "12:00", lunchEnd: "13:30" };
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** Stored windows -> one form row per day, Monday first. */
export function weekFormFromWindows(windows: AvailabilityWindowRow[]): DayForm[] {
  return WEEK_ORDER.map((dayOfWeek) => {
    const ranges = windows
      .filter((window) => window.day_of_week === dayOfWeek)
      .map((window) => ({ start: hhmm(window.start_time), end: hhmm(window.end_time) }))
      .sort((a, b) => a.start.localeCompare(b.start));

    if (ranges.length === 0) {
      return { dayOfWeek, open: false, lunch: false, extraRanges: false, ...DEFAULT_DAY };
    }
    const first = ranges[0];
    const last = ranges[ranges.length - 1];
    if (ranges.length === 1) {
      return {
        dayOfWeek,
        open: true,
        opens: first.start,
        closes: first.end,
        lunch: false,
        lunchStart: DEFAULT_DAY.lunchStart,
        lunchEnd: DEFAULT_DAY.lunchEnd,
        extraRanges: false,
      };
    }
    return {
      dayOfWeek,
      open: true,
      opens: first.start,
      closes: last.end,
      lunch: true,
      lunchStart: first.end,
      lunchEnd: ranges[1].start,
      extraRanges: ranges.length > 2,
    };
  });
}

/**
 * Form rows -> windows to store, or the first problem per day. A closed
 * day stores nothing; a lunch break must sit strictly inside the opening
 * hours, so the morning and afternoon windows are both non-empty.
 */
export function windowsFromWeekForm(days: DayForm[]) {
  const windows: { day_of_week: number; start_time: string; end_time: string }[] = [];
  const errors: Partial<Record<number, DayFormError>> = {};

  for (const day of days) {
    if (!day.open) continue;
    const times = day.lunch ? [day.opens, day.closes, day.lunchStart, day.lunchEnd] : [day.opens, day.closes];
    if (!times.every((time) => TIME_PATTERN.test(time))) {
      errors[day.dayOfWeek] = "invalidTime";
      continue;
    }
    if (day.closes <= day.opens) {
      errors[day.dayOfWeek] = "closeBeforeOpen";
      continue;
    }
    if (day.lunch) {
      if (!(day.opens < day.lunchStart && day.lunchStart < day.lunchEnd && day.lunchEnd < day.closes)) {
        errors[day.dayOfWeek] = "lunchOutsideHours";
        continue;
      }
      windows.push(
        { day_of_week: day.dayOfWeek, start_time: day.opens, end_time: day.lunchStart },
        { day_of_week: day.dayOfWeek, start_time: day.lunchEnd, end_time: day.closes }
      );
    } else {
      windows.push({ day_of_week: day.dayOfWeek, start_time: day.opens, end_time: day.closes });
    }
  }
  return { windows, errors };
}

/**
 * Sorted "YYYY-MM-DD" keys -> runs of consecutive days, for showing
 * closures as "24 Dec – 2 Jan" instead of ten separate rows.
 */
export function groupConsecutiveDates(dates: string[]) {
  const runs: { from: string; to: string }[] = [];
  for (const date of [...dates].sort()) {
    const last = runs[runs.length - 1];
    if (last && nextDateKey(last.to) === date) last.to = date;
    else runs.push({ from: date, to: date });
  }
  return runs;
}

function nextDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
}
