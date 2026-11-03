import type { AvailabilityWindow } from "@/lib/slots";
import { zonedDateTimeToUtc } from "@/lib/timezone";

/**
 * The dashboard agenda's filter tabs. Lives here, not in the client
 * component: a server component importing a plain value from a
 * "use client" module only gets a client reference, not the array.
 */
// No "pending approval" tab: bookings are confirmed on creation in the
// pay-on-site pilot (0040). Older pending rows surface as a dashboard
// callout instead.
export const AGENDA_VIEWS = ["today", "week"] as const;
export type AgendaView = (typeof AGENDA_VIEWS)[number];

export function parseAgendaView(value: unknown): AgendaView {
  return AGENDA_VIEWS.find((view) => view === value) ?? "today";
}

/**
 * What the garage dashboard shows on an appointment card. Derived, not
 * stored: the booking lifecycle (appointments.status) and the repair
 * tracker (appointments.repair_stage, 0024) stay separate in the DB, and
 * this folds them into one glanceable state.
 *
 *   pending                      -> awaiting_action (the garage must confirm)
 *   confirmed + stage or started -> in_progress
 *   confirmed                    -> confirmed
 *   completed / cancelled        -> themselves
 *
 * pending_payment never reaches the dashboard (checkout not finished), but
 * maps to awaiting_action defensively rather than throwing.
 */
export type AgendaBadge =
  | "awaiting_action"
  | "confirmed"
  | "in_progress"
  | "completed"
  | "cancelled";

export function agendaBadge(
  appointment: { status: string; repair_stage: string | null; start_time: string },
  now: Date = new Date()
): AgendaBadge {
  switch (appointment.status) {
    case "confirmed":
      return appointment.repair_stage !== null ||
        new Date(appointment.start_time).getTime() <= now.getTime()
        ? "in_progress"
        : "confirmed";
    case "completed":
      return "completed";
    case "cancelled":
      return "cancelled";
    default:
      return "awaiting_action";
  }
}

export type DayCapacity =
  | { kind: "closed" }
  | { kind: "no_mechanics" }
  | {
      kind: "open";
      bookedMinutes: number;
      capacityMinutes: number;
      // 0-100, rounded; clamped so a stale assignment (e.g. a job still
      // held by a mechanic who has since left the team) can't push the
      // meter past full.
      percent: number;
    };

/**
 * Today's shop load in mechanic-minutes: opening minutes x bookable
 * mechanics (0037's capacity) against the time booked jobs occupy inside
 * those opening windows. Minutes, not "slots": slot length depends on each
 * service's duration, so a slot count would be meaningless across services.
 *
 * `bookings` must already exclude cancelled appointments; pending_payment
 * holds count, because they hold a mechanic until checkout expires.
 */
export function computeDayCapacity({
  date,
  windows,
  mechanicCount,
  bookings,
}: {
  date: string; // "YYYY-MM-DD" in APP_TIME_ZONE
  windows: AvailabilityWindow[];
  mechanicCount: number;
  bookings: { start_time: string; end_time: string }[];
}): DayCapacity {
  const intervals = windows
    .map((window) => ({
      start: zonedDateTimeToUtc(date, window.start_time).getTime(),
      end: zonedDateTimeToUtc(date, window.end_time).getTime(),
    }))
    .filter((interval) => interval.end > interval.start);

  const openMinutes = intervals.reduce(
    (total, interval) => total + (interval.end - interval.start) / 60000,
    0
  );

  if (openMinutes === 0) return { kind: "closed" };
  if (mechanicCount < 1) return { kind: "no_mechanics" };

  const capacityMinutes = openMinutes * mechanicCount;

  // Windows can't overlap (0035), so summing per-window overlap never
  // double-counts a booking.
  let bookedMinutes = 0;
  for (const booking of bookings) {
    const bookingStart = new Date(booking.start_time).getTime();
    const bookingEnd = new Date(booking.end_time).getTime();
    for (const interval of intervals) {
      const overlap =
        Math.min(bookingEnd, interval.end) - Math.max(bookingStart, interval.start);
      if (overlap > 0) bookedMinutes += overlap / 60000;
    }
  }

  return {
    kind: "open",
    bookedMinutes: Math.round(bookedMinutes),
    capacityMinutes: Math.round(capacityMinutes),
    percent: Math.min(100, Math.round((bookedMinutes / capacityMinutes) * 100)),
  };
}

/** "90" -> "1 h 30", "60" -> "1 h", "45" -> "45 min". Same in FR and EN. */
export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest} min`;
  return rest === 0 ? `${hours} h` : `${hours} h ${String(rest).padStart(2, "0")}`;
}

/** Whether `now` falls inside one of `date`'s wall-clock windows. */
export function isOpenAt({
  date,
  windows,
  now,
}: {
  date: string;
  windows: AvailabilityWindow[];
  now: Date;
}) {
  const time = now.getTime();
  return windows.some(
    (window) =>
      zonedDateTimeToUtc(date, window.start_time).getTime() <= time &&
      time < zonedDateTimeToUtc(date, window.end_time).getTime()
  );
}

export type MechanicStatus =
  | { kind: "busy"; until: string } // ISO end of the current job
  | { kind: "free"; nextAt: string | null } // ISO start of the next job today
  | { kind: "off"; nextAt: string | null }; // shop closed right now

/**
 * One mechanic's state right now, for the dashboard's "Team today" panel.
 * Only open jobs (pending/confirmed) count: a job marked completed early
 * frees the mechanic even if its slot hasn't ended. `appointments` are
 * today's, any mechanic; mechanics follow the garage's opening hours
 * (0037's v1 limitation), so "off" just means the shop is closed now.
 */
export function mechanicStatus({
  mechanicId,
  appointments,
  now,
  shopOpen,
}: {
  mechanicId: string;
  appointments: {
    assigned_mechanic_id: string | null;
    status: string;
    start_time: string;
    end_time: string;
  }[];
  now: Date;
  shopOpen: boolean;
}): MechanicStatus {
  const time = now.getTime();
  const open = appointments
    .filter(
      (appointment) =>
        appointment.assigned_mechanic_id === mechanicId &&
        (appointment.status === "pending" || appointment.status === "confirmed")
    )
    .sort((a, b) => a.start_time.localeCompare(b.start_time));

  const current = open.find(
    (appointment) =>
      new Date(appointment.start_time).getTime() <= time &&
      time < new Date(appointment.end_time).getTime()
  );
  if (current) return { kind: "busy", until: current.end_time };

  const next =
    open.find((appointment) => new Date(appointment.start_time).getTime() > time)
      ?.start_time ?? null;
  return shopOpen ? { kind: "free", nextAt: next } : { kind: "off", nextAt: next };
}
