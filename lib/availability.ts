import { createClient } from "@/lib/supabase/server";
import { computeAvailableSlots } from "@/lib/slots";

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
  const dayOfWeek = new Date(`${date}T00:00:00`).getDay();

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

  const dayStart = new Date(`${date}T00:00:00`);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayStart.getDate() + 1);

  // A security-definer RPC, not a direct table select: appointments' RLS
  // only lets the appointment's own client or a garage member see a row, so
  // a browsing client's session can't see a *different* client's booking --
  // this returns only start_time/end_time (public availability info, no
  // client identity) regardless of who's asking.
  const { data: appointments } = (await supabase.rpc("get_booked_ranges", {
    target_garage_id: garageId,
    range_start: dayStart.toISOString(),
    range_end: dayEnd.toISOString(),
    exclude_appointment_id: excludeAppointmentId ?? null,
  })) as { data: { start_time: string; end_time: string }[] | null };

  const slots = computeAvailableSlots({
    date,
    windows,
    durationMinutes,
    bookedRanges: (appointments ?? []).map((appointment) => ({
      start: new Date(appointment.start_time),
      end: new Date(appointment.end_time),
    })),
  });

  return { slots, isClosed };
}
