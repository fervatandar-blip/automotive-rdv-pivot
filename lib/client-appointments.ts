import "server-only";
import type { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

export type ClientAppointment = {
  id: string;
  start_time: string;
  status: string;
  repair_stage: string | null;
  services: { name: string } | null;
  garages: {
    name: string;
    city: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  vehicles: {
    id: string;
    model: string | null;
    year: number | null;
    license_plate: string | null;
    brands: { name: string } | null;
  } | null;
};

export type ClientWaitlistEntry = {
  id: string;
  date: string;
  notified_at: string | null;
  services: { name: string } | null;
  garages: { name: string } | null;
};

const APPOINTMENT_COLUMNS =
  "id, start_time, status, repair_stage, services(name), garages!appointments_garage_id_fkey(name, city, address, latitude, longitude), vehicles(id, model, year, license_plate, brands(name))";

/** Booked or confirmed, and not yet started. */
export function isUpcoming(appointment: { status: string; start_time: string }, now = Date.now()) {
  return (
    (appointment.status === "pending" || appointment.status === "confirmed") &&
    new Date(appointment.start_time).getTime() >= now
  );
}

export function isOpen(appointment: { status: string }) {
  return appointment.status === "pending" || appointment.status === "confirmed";
}

/**
 * The client's appointments split into upcoming (soonest first) and past
 * (most recent first), plus which completed ones already have a review.
 * RLS limits every query to the signed-in client's own rows; the explicit
 * client_id filter keeps the queries on the index.
 */
export async function loadClientAppointments(supabase: SupabaseClient, clientId: string) {
  const { data } = await supabase
    .from("appointments")
    .select(APPOINTMENT_COLUMNS)
    .eq("client_id", clientId)
    .order("start_time", { ascending: true });

  const rows = (data ?? []) as unknown as ClientAppointment[];
  const now = Date.now();
  const upcoming = rows.filter((row) => isUpcoming(row, now));
  const past = rows.filter((row) => !isUpcoming(row, now)).reverse();

  const completedIds = past.filter((row) => row.status === "completed").map((row) => row.id);
  const reviewed = new Set<string>();
  if (completedIds.length > 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("appointment_id")
      .in("appointment_id", completedIds);
    for (const review of reviews ?? []) reviewed.add(review.appointment_id);
  }

  return { upcoming, past, reviewed, completedIds };
}

/**
 * Short-lived download links for the invoices of these appointments, in one
 * storage call. Appointments without an invoice are simply absent.
 */
export async function loadInvoiceUrls(supabase: SupabaseClient, appointmentIds: string[]) {
  const urls = new Map<string, string>();
  if (appointmentIds.length === 0) return urls;

  const { data: invoices } = await supabase
    .from("invoices")
    .select("appointment_id, file_path")
    .in("appointment_id", appointmentIds);
  if (!invoices || invoices.length === 0) return urls;

  const { data: signed } = await supabase.storage
    .from("invoices")
    .createSignedUrls(
      invoices.map((invoice) => invoice.file_path),
      60 * 10,
    );
  const byPath = new Map((signed ?? []).map((entry) => [entry.path, entry.signedUrl]));
  for (const invoice of invoices) {
    const url = byPath.get(invoice.file_path);
    if (url) urls.set(invoice.appointment_id, url);
  }
  return urls;
}

export async function loadClientWaitlist(supabase: SupabaseClient, clientId: string) {
  const { data } = await supabase
    .from("waitlist")
    .select("id, date, notified_at, services(name), garages(name)")
    .eq("client_id", clientId)
    .order("date", { ascending: true });
  return (data ?? []) as unknown as ClientWaitlistEntry[];
}
