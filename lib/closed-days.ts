import { dayOfWeekForDateKey } from "@/lib/timezone";

export type DayOverride = { date: string; is_closed: boolean };

/**
 * Which of `dateKeys` a workshop is closed on, for the booking calendar.
 * Same precedence as getBookableWindowsForDate (lib/availability.ts):
 *   - a closed override closes the day;
 *   - any other override for the day replaces the weekly hours, so it's open;
 *   - otherwise the day is open when the weekly hours have a window for
 *     that weekday.
 * A day that is open but fully booked is not "closed": it stays clickable
 * so the client can see it's full and join the waitlist.
 */
export function closedDateKeys({
  dateKeys,
  openWeekdays,
  overrides,
}: {
  dateKeys: string[];
  /** Days of week (0 = Sunday) with at least one weekly window. */
  openWeekdays: ReadonlySet<number>;
  overrides: DayOverride[];
}): Set<string> {
  const byDate = new Map<string, DayOverride[]>();
  for (const override of overrides) {
    const list = byDate.get(override.date) ?? [];
    list.push(override);
    byDate.set(override.date, list);
  }

  const closed = new Set<string>();
  for (const key of dateKeys) {
    const dayOverrides = byDate.get(key);
    if (dayOverrides && dayOverrides.length > 0) {
      if (dayOverrides.some((override) => override.is_closed)) closed.add(key);
      continue;
    }
    if (!openWeekdays.has(dayOfWeekForDateKey(key))) closed.add(key);
  }
  return closed;
}
