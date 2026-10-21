/**
 * Every garage on the platform is in LU, BE, FR or DE (garages.country
 * check constraint, 0018), and all four share Central European Time with
 * identical DST rules -- so one fixed zone is correct for all of them.
 *
 * Opening hours (availability.start_time/end_time), override dates and the
 * date/time a client picks are all *wall-clock* values in this zone. They
 * must never be turned into instants with `new Date("YYYY-MM-DDTHH:MM")`:
 * that parses in the server process's zone, which is UTC on Vercel (and
 * `TZ` is a reserved env var there, so it can't be overridden). Use these
 * helpers instead, and pass `timeZone: APP_TIME_ZONE` to every
 * Intl/toLocale* call that renders a stored instant.
 */
export const APP_TIME_ZONE = "Europe/Luxembourg";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: APP_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function zonedParts(instant: Date) {
  const values: Record<string, number> = {};
  for (const part of partsFormatter.formatToParts(instant)) {
    if (part.type !== "literal") values[part.type] = Number(part.value);
  }
  return values as {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
  };
}

/** The zone's UTC offset at `instant`, in milliseconds (+1h/+2h for CET/CEST). */
function zoneOffsetMs(instant: Date) {
  const p = zonedParts(instant);
  const wallClockAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  const wholeSeconds = Math.floor(instant.getTime() / 1000) * 1000;
  return wallClockAsUtc - wholeSeconds;
}

function parseDateKeyParts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return { year, month, day };
}

/**
 * The instant at which the wall clock in APP_TIME_ZONE reads `time` on
 * `dateKey`. `time` is "HH:MM" or "HH:MM:SS".
 *
 * DST edge cases: a wall-clock time inside the spring-forward gap
 * (02:00-03:00 on the last Sunday of March) doesn't exist and resolves to
 * the equivalent post-transition instant; an ambiguous time in the
 * autumn fall-back hour resolves to its first (CEST) occurrence. Neither
 * window falls inside any realistic garage opening hours.
 */
export function zonedDateTimeToUtc(dateKey: string, time: string): Date {
  const { year, month, day } = parseDateKeyParts(dateKey);
  const [hours, minutes, seconds = 0] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hours, minutes, seconds);

  // Two passes: the first guess uses the offset at the naive instant, which
  // is wrong only when a DST transition lies between the two.
  const firstOffset = zoneOffsetMs(new Date(wallClockAsUtc));
  const firstGuess = wallClockAsUtc - firstOffset;
  const secondOffset = zoneOffsetMs(new Date(firstGuess));
  return new Date(secondOffset === firstOffset ? firstGuess : wallClockAsUtc - secondOffset);
}

/** Midnight at the start of `dateKey` in APP_TIME_ZONE, as an instant. */
export function zonedStartOfDay(dateKey: string): Date {
  return zonedDateTimeToUtc(dateKey, "00:00");
}

/** The APP_TIME_ZONE calendar date ("YYYY-MM-DD") that `instant` falls on. */
export function dateKeyInAppZone(instant: Date): string {
  const p = zonedParts(instant);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

/** Today's date ("YYYY-MM-DD") in APP_TIME_ZONE. */
export function todayKeyInAppZone(now: Date = new Date()): string {
  return dateKeyInAppZone(now);
}

/** Pure calendar arithmetic on a "YYYY-MM-DD" key; no zone involved. */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const { year, month, day } = parseDateKeyParts(dateKey);
  const shifted = new Date(Date.UTC(year, month - 1, day + days));
  return shifted.toISOString().slice(0, 10);
}

/** 0 = Sunday ... 6 = Saturday, matching availability.day_of_week. */
export function dayOfWeekForDateKey(dateKey: string): number {
  const { year, month, day } = parseDateKeyParts(dateKey);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

/**
 * A Date for *displaying* a date-only key (waitlist dates, override dates).
 * Noon UTC is the same calendar day in every European zone, so formatting
 * it with `timeZone: APP_TIME_ZONE` always shows `dateKey` itself.
 */
export function dateKeyToDisplayDate(dateKey: string): Date {
  const { year, month, day } = parseDateKeyParts(dateKey);
  return new Date(Date.UTC(year, month - 1, day, 12));
}
