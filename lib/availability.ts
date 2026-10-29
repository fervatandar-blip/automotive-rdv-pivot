import { createClient } from "@/lib/supabase/server";
import { computeAvailableSlots } from "@/lib/slots";
import {
  addDaysToDateKey,
  dayOfWeekForDateKey,
  zonedStartOfDay,
} from "@/lib/timezone";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Resolves a garage's bookable slots for one date: a closed override wins
 * outright, a non-closed override's windows replace (not add to) the
 * recurring weekly schedule, otherwise the recurring `availability` rows for
 * that day of week apply. `excludeAppointmentId` lets a reschedule picker
 * treat the appointment being moved as not-yet-booked against itself.
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
  const dayOfWeek = dayOfWeekForDateKey(date);

  const { data: overrides } = await supabase
    .from("availability_overrides")
    .select("is_closed, start_time, end_time")
    .eq("garage_id", garageId)
    .eq("date", date);

  const isClosed = (overrides ?? []).some((override) => override.is_closed);

  let windows: { start_time: string; end_time: string }[];
  if (isClosed) {
    windows = [];
  } else if (overrides && overrides.length > 0) {
    windows = overrides as { start_time: string; end_time: string }[];
  } else {
    const { data: recurringWindows } = await supabase
      .from("availability")
      .select("start_time, end_time")
      .eq("garage_id", garageId)
      .eq("day_of_week", dayOfWeek);
    windows = recurringWindows ?? [];
  }

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
  const [{ data: appointments }, { data: capacity }] = await Promise.all([
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
