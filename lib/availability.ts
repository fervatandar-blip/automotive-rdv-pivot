import { createClient } from "@/lib/supabase/server";
import {
  computeAvailableSlots,
  subtractBlockedRanges,
  type AvailabilityWindow,
  type BlockedRange,
} from "@/lib/slots";
import {
  addDaysToDateKey,
  dayOfWeekForDateKey,
  zonedStartOfDay,
} from "@/lib/timezone";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * A garage's bookable windows for one date, in three layers:
 *   1. a closed override wins outright;
 *   2. otherwise a non-closed override's window replaces (not adds to) the
 *      recurring weekly schedule, else the recurring `availability` rows
 *      for that day of week apply;
 *   3. intraday blocks (availability_blocks, 0039) are cut out of whatever
 *      is left.
 * Shared by slot computation and the dashboard's capacity meter so both
 * agree on what "open" means. `isClosed` reflects only a whole-day closure
 * override, not a day that happens to be fully blocked.
 */
export async function getBookableWindowsForDate({
  supabase,
  garageId,
  date,
}: {
  supabase: SupabaseClient;
  garageId: string;
  date: string;
}): Promise<{ windows: AvailabilityWindow[]; isClosed: boolean }> {
  const dayStart = zonedStartOfDay(date);
  const dayEnd = zonedStartOfDay(addDaysToDateKey(date, 1));

  const [{ data: overrides }, blocks] = await Promise.all([
    supabase
      .from("availability_overrides")
      .select("is_closed, start_time, end_time")
      .eq("garage_id", garageId)
      .eq("date", date),
    getBlockedRanges({ supabase, garageId, rangeStart: dayStart, rangeEnd: dayEnd }),
  ]);

  const isClosed = (overrides ?? []).some((override) => override.is_closed);
  if (isClosed) {
    return { windows: [], isClosed: true };
  }

  let windows: AvailabilityWindow[];
  if (overrides && overrides.length > 0) {
    windows = overrides as AvailabilityWindow[];
  } else {
    const { data: recurringWindows } = await supabase
      .from("availability")
      .select("start_time, end_time")
      .eq("garage_id", garageId)
      .eq("day_of_week", dayOfWeekForDateKey(date));
    windows = recurringWindows ?? [];
  }

  return {
    windows: subtractBlockedRanges({ date, windows, blocks }),
    isClosed: false,
  };
}

/**
 * Garage-wide blocked ranges overlapping [rangeStart, rangeEnd), through
 * the security-definer RPC so anonymous visitors computing slots get the
 * times but never the internal reason.
 *
 * Fails open (no blocks) on an RPC error, logged: a broken block lookup
 * must not take every garage's booking page down with it. The cost is
 * that a booking could land inside a block until it's fixed.
 */
async function getBlockedRanges({
  supabase,
  garageId,
  rangeStart,
  rangeEnd,
}: {
  supabase: SupabaseClient;
  garageId: string;
  rangeStart: Date;
  rangeEnd: Date;
}): Promise<BlockedRange[]> {
  const { data, error } = (await supabase.rpc("get_availability_blocks", {
    target_garage_id: garageId,
    range_start: rangeStart.toISOString(),
    range_end: rangeEnd.toISOString(),
  })) as unknown as {
    data: { starts_at: string; ends_at: string }[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("[availability] get_availability_blocks failed:", error.message);
    return [];
  }

  return (data ?? []).map((block) => ({
    start: new Date(block.starts_at),
    end: new Date(block.ends_at),
  }));
}

/**
 * Resolves a garage's bookable slots for one date (windows per
 * getBookableWindowsForDate). `excludeAppointmentId` lets a reschedule
 * picker treat the appointment being moved as not-yet-booked against itself.
 */
export async function getAvailableSlotsForDate({
  supabase,
  garageId,
  date,
  durationMinutes,
  excludeAppointmentId,
}: {
  supabase: SupabaseClient;
  garageId: string;
  date: string;
  durationMinutes: number;
  excludeAppointmentId?: string;
}): Promise<{ slots: string[]; isClosed: boolean }> {
  // The garage's local day, not the server's: on a UTC server a UTC-midnight
  // window would miss bookings between 00:00 and 01:00/02:00 local time and
  // pull in the previous evening's instead.
  const dayStart = zonedStartOfDay(date);
  const dayEnd = zonedStartOfDay(addDaysToDateKey(date, 1));

  // Security-definer RPCs, not direct table selects: appointments' RLS
  // only lets the appointment's own client or a garage member see a row,
  // so a browsing client can't see other bookings. These return only
  // start/end times with an anonymous per-mechanic lane, plus how many
  // mechanics can be booked in parallel (0037).
  const [{ windows, isClosed }, { data: appointments }, { data: capacity }] =
    await Promise.all([
      getBookableWindowsForDate({ supabase, garageId, date }),
      supabase.rpc("get_booked_ranges", {
        target_garage_id: garageId,
        range_start: dayStart.toISOString(),
        range_end: dayEnd.toISOString(),
        exclude_appointment_id: excludeAppointmentId ?? null,
      }) as unknown as Promise<{
        data: { start_time: string; end_time: string; lane: number }[] | null;
      }>,
      supabase.rpc("get_bookable_mechanic_count", {
        target_garage_id: garageId,
      }) as unknown as Promise<{ data: number | null }>,
    ]);

  const slots = computeAvailableSlots({
    date,
    windows,
    durationMinutes,
    capacity: capacity ?? 0,
    bookedRanges: (appointments ?? []).map((appointment) => ({
      start: new Date(appointment.start_time),
      end: new Date(appointment.end_time),
      lane: appointment.lane,
    })),
  });

  return { slots, isClosed };
}

export type DaySchedule = {
  // Opening windows after overrides, before blocks (blocks are drawn
  // separately so the grid can label them).
  windows: AvailabilityWindow[];
  isClosed: boolean;
  blocks: { id: string; start: Date; end: Date; reason: string | null }[];
};

/**
 * Opening hours, overrides and intraday blocks for a run of dates in three
 * queries total (the calendar shows up to 42 days at once). Same resolution
 * order as getBookableWindowsForDate. Garage members only: blocks are read
 * straight from availability_blocks (RLS, 0039) so the reason comes along.
 */
export async function getScheduleForDates({
  supabase,
  garageId,
  dates,
}: {
  supabase: SupabaseClient;
  garageId: string;
  dates: string[];
}): Promise<Map<string, DaySchedule>> {
  const schedule = new Map<string, DaySchedule>();
  if (dates.length === 0) return schedule;

  const first = dates[0];
  const last = dates[dates.length - 1];
  const [{ data: weekly }, { data: overrides }, { data: blocks }] = await Promise.all([
    supabase.from("availability").select("day_of_week, start_time, end_time").eq("garage_id", garageId),
    supabase
      .from("availability_overrides")
      .select("date, is_closed, start_time, end_time")
      .eq("garage_id", garageId)
      .gte("date", first)
      .lte("date", last),
    supabase
      .from("availability_blocks")
      .select("id, starts_at, ends_at, reason")
      .eq("garage_id", garageId)
      .lt("starts_at", zonedStartOfDay(addDaysToDateKey(last, 1)).toISOString())
      .gt("ends_at", zonedStartOfDay(first).toISOString())
      .order("starts_at"),
  ]);

  for (const date of dates) {
    const dayOverrides = (overrides ?? []).filter((override) => override.date === date);
    const isClosed = dayOverrides.some((override) => override.is_closed);
    const windows: AvailabilityWindow[] = isClosed
      ? []
      : dayOverrides.length > 0
        ? (dayOverrides as AvailabilityWindow[])
        : (weekly ?? []).filter((row) => row.day_of_week === dayOfWeekForDateKey(date));
    const dayStart = zonedStartOfDay(date).getTime();
    const dayEnd = zonedStartOfDay(addDaysToDateKey(date, 1)).getTime();
    schedule.set(date, {
      windows,
      isClosed,
      blocks: (blocks ?? [])
        .map((block) => ({
          id: block.id as string,
          start: new Date(block.starts_at),
          end: new Date(block.ends_at),
          reason: (block.reason as string | null) ?? null,
        }))
        .filter((block) => block.start.getTime() < dayEnd && block.end.getTime() > dayStart),
    });
  }
  return schedule;
}
