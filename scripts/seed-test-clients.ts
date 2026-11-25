/**
 * Seeds the demo client account against a seeded test garage, so every part
 * of the client area (and the garage's client directory) has something to
 * show:
 *
 *   - a filled-in profile (name, phone, notification preferences, locale)
 *   - two vehicles, one with a VIN (plate/VIN search in the client directory)
 *   - a timeline relative to TODAY, so it never goes stale:
 *       ~8 weeks ago  completed  Vidange                + a 5-star review
 *       ~3 weeks ago  completed  Contrôle des freins    (left unreviewed, so
 *                                                        the review form shows)
 *       ~10 days ago  cancelled  Diagnostic complet
 *       in ~3 days    confirmed  Permutation des pneus  + a client/garage chat
 *       in ~8 days    confirmed  Diagnostic complet
 *   - a waitlist entry in ~5 days
 *
 * Usage:
 *   node scripts/seed-test-clients.ts [garage-owner-email] [client-email] [--reset-password]
 *
 * Defaults: garage demo-garage@rdv.invalid (run seed-test-garage.ts on it
 * first), client demo-client@rdv.invalid. .invalid addresses can never
 * receive mail, so no notification ever reaches a real inbox.
 *
 * Re-running RESETS the client's appointments (with their reviews and
 * messages) and waitlist entries at that garage, then rebuilds the
 * timeline. That's why the client must be an @rdv.invalid account: the
 * script refuses to wipe a real person's bookings.
 *
 * The password is random and printed only when the account is created or
 * with --reset-password. There is only one Supabase project (production),
 * so a fixed, guessable password would be a live account anyone could use.
 *
 * Service-role key: bypasses RLS and writes completed/confirmed
 * appointments with no payment behind them. Demo data only.
 */

import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));

// lib/supabase/admin.ts starts with `import "server-only"`, which throws
// outside Next's bundler, so the same service-role client is built here.
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local");
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

const DEMO_DOMAIN = "@rdv.invalid";
const DEFAULT_GARAGE_OWNER = `demo-garage${DEMO_DOMAIN}`;
const DEFAULT_CLIENT = `demo-client${DEMO_DOMAIN}`;

const PROFILE = {
  full_name: "Demo Client",
  phone: "+352 621 000 000",
  preferred_locale: "fr",
  notify_repair_updates: true,
  notify_waitlist: true,
};

const VEHICLES = [
  { brand: "Volkswagen", model: "Golf", year: 2019, license_plate: "LU-1234", vin: "WVWZZZ1KZAW123456" },
  { brand: "BMW", model: "320d", year: 2021, license_plate: "AB 5678", vin: null },
];

type Status = "completed" | "cancelled" | "confirmed";

// dayOffset is from today (Luxembourg date); the nearest open day in that
// direction is used. preferredTime is the first slot tried on that day.
const TIMELINE: {
  key: string;
  vehicle: number;
  service: string;
  dayOffset: number;
  preferredTime: string;
  status: Status;
}[] = [
  { key: "oil", vehicle: 0, service: "Vidange", dayOffset: -56, preferredTime: "09:00", status: "completed" },
  { key: "brakes", vehicle: 0, service: "Contrôle des freins", dayOffset: -21, preferredTime: "14:00", status: "completed" },
  { key: "diag-cancelled", vehicle: 1, service: "Diagnostic complet", dayOffset: -10, preferredTime: "10:00", status: "cancelled" },
  { key: "tires", vehicle: 1, service: "Permutation des pneus", dayOffset: 3, preferredTime: "11:00", status: "confirmed" },
  { key: "diag", vehicle: 0, service: "Diagnostic complet", dayOffset: 8, preferredTime: "09:00", status: "confirmed" },
];

const REVIEW = {
  on: "oil",
  rating: 5,
  comment: "Service rapide et aimable, la voiture était prête à l'heure. Je recommande.",
};

const MESSAGES: { on: string; from: "client" | "garage"; body: string }[] = [
  { on: "tires", from: "client", body: "Bonjour, pourriez-vous aussi vérifier le capteur de pression des pneus ? Le voyant s'allume par intermittence." },
  { on: "tires", from: "garage", body: "Bonjour, oui bien sûr, nous le contrôlerons pendant le rendez-vous." },
];

const WAITLIST = { service: "Vidange", dayOffset: 5 };

// --- Europe/Luxembourg wall-clock helpers --------------------------------
// Same rules as lib/timezone.ts (inlined: a plain-node script can't import
// app modules through the "@/" alias, and importing a ".ts" path directly
// would break `tsc` without allowImportingTsExtensions).

const ZONE = "Europe/Luxembourg";

function zoneOffsetMs(instant: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: ZONE,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value])
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

function zonedDateTimeToUtc(dateKey: string, time: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day, hours, minutes);
  const firstOffset = zoneOffsetMs(new Date(wallClockAsUtc));
  const firstGuess = wallClockAsUtc - firstOffset;
  const secondOffset = zoneOffsetMs(new Date(firstGuess));
  return new Date(secondOffset === firstOffset ? firstGuess : wallClockAsUtc - secondOffset);
}

function todayKey(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE }).format(new Date());
}

function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function dayOfWeek(dateKey: string): number {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};
const toTime = (minutes: number) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

// -------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2);
  const resetPassword = args.includes("--reset-password");
  const positional = args.filter((arg) => !arg.startsWith("--"));
  const ownerEmail = (positional[0] ?? DEFAULT_GARAGE_OWNER).toLowerCase();
  const clientEmail = (positional[1] ?? DEFAULT_CLIENT).toLowerCase();

  if (!clientEmail.endsWith(DEMO_DOMAIN)) {
    fail(`Refusing to seed ${clientEmail}: this script deletes the client's bookings, so it only runs on ${DEMO_DOMAIN} accounts.`);
  }

  const supabase = createAdminClient();

  // --- Garage, services, opening hours ---------------------------------
  const { data: owner } = await supabase.from("profiles").select("id").eq("email", ownerEmail).maybeSingle();
  if (!owner) fail(`No profile for ${ownerEmail}.`);
  const { data: garage } = await supabase
    .from("garages")
    .select("id, name, status")
    .eq("owner_id", owner.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!garage) fail(`${ownerEmail} owns no garage.`);
  if (garage.status !== "approved") {
    console.warn(`Warning: "${garage.name}" is ${garage.status}, so clients can't find it in search.`);
  }

  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("garage_id", garage.id);
  const serviceByName = new Map((services ?? []).map((service) => [service.name, service]));
  const needed = new Set([...TIMELINE.map((item) => item.service), WAITLIST.service]);
  const missing = [...needed].filter((name) => !serviceByName.has(name));
  if (missing.length > 0) {
    fail(`"${garage.name}" is missing services: ${missing.join(", ")}. Run: node scripts/seed-test-garage.ts ${ownerEmail}`);
  }

  const { data: availability } = await supabase
    .from("availability")
    .select("day_of_week, start_time, end_time")
    .eq("garage_id", garage.id);
  const windowsByDay = new Map<number, { start: number; end: number }[]>();
  for (const row of availability ?? []) {
    const windows = windowsByDay.get(row.day_of_week) ?? [];
    windows.push({ start: toMinutes(row.start_time), end: toMinutes(row.end_time) });
    windowsByDay.set(row.day_of_week, windows.sort((a, b) => a.start - b.start));
  }
  if (windowsByDay.size === 0) {
    fail(`"${garage.name}" has no opening hours. Run: node scripts/seed-test-garage.ts ${ownerEmail}`);
  }

  /** The open day nearest to today + offset, moving away from today. */
  function openDay(offset: number): string {
    const step = offset < 0 ? -1 : 1;
    let key = addDays(todayKey(), offset);
    for (let i = 0; i < 14; i++, key = addDays(key, step)) {
      if (windowsByDay.has(dayOfWeek(key))) return key;
    }
    fail("Could not find an open day within two weeks of the target date.");
  }

  /** Start times on `dateKey` where a job of `duration` fits, preferred one first. */
  function candidateTimes(dateKey: string, duration: number, preferred: string): string[] {
    const times: number[] = [];
    for (const window of windowsByDay.get(dayOfWeek(dateKey)) ?? []) {
      for (let start = window.start; start + duration <= window.end; start += 30) times.push(start);
    }
    const preferredMinutes = toMinutes(preferred);
    return times
      .sort((a, b) => Math.abs(a - preferredMinutes) - Math.abs(b - preferredMinutes))
      .map(toTime);
  }

  // --- Client account ---------------------------------------------------
  let clientId: string;
  let password: string | null = null;
  const { data: existingClient } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", clientEmail)
    .maybeSingle();

  if (existingClient) {
    if (existingClient.role !== "client") fail(`${clientEmail} exists with role ${existingClient.role}, not client.`);
    clientId = existingClient.id;
    if (resetPassword) {
      password = `Rdv-${randomBytes(18).toString("base64url")}1a`;
      const { error } = await supabase.auth.admin.updateUserById(clientId, { password });
      if (error) fail(`Could not reset the password: ${error.message}`);
    }
  } else {
    password = `Rdv-${randomBytes(18).toString("base64url")}1a`;
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: clientEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: PROFILE.full_name },
    });
    if (error || !created.user) fail(`Could not create ${clientEmail}: ${error?.message}`);
    clientId = created.user.id;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ ...PROFILE, terms_accepted_at: new Date().toISOString() })
    .eq("id", clientId);
  if (profileError) fail(`Could not update the client profile: ${profileError.message}`);

  // --- Vehicles (reused by plate) ---------------------------------------
  const vehicleIds: string[] = [];
  for (const vehicle of VEHICLES) {
    const { data: existing } = await supabase
      .from("vehicles")
      .select("id")
      .eq("client_id", clientId)
      .eq("license_plate", vehicle.license_plate)
      .maybeSingle();
    if (existing) {
      vehicleIds.push(existing.id);
      continue;
    }
    const { data: brand } = await supabase.from("brands").select("id").eq("name", vehicle.brand).maybeSingle();
    const { data: inserted, error } = await supabase
      .from("vehicles")
      .insert({
        client_id: clientId,
        brand_id: brand?.id ?? null,
        model: vehicle.model,
        year: vehicle.year,
        license_plate: vehicle.license_plate,
        vin: vehicle.vin,
      })
      .select("id")
      .single();
    if (error || !inserted) fail(`Could not insert vehicle ${vehicle.license_plate}: ${error?.message}`);
    vehicleIds.push(inserted.id);
  }

  // --- Reset this client's history at this garage -----------------------
  // Reviews, messages, invoices and payments cascade from appointments.
  const { error: deleteError } = await supabase
    .from("appointments")
    .delete()
    .eq("client_id", clientId)
    .eq("garage_id", garage.id);
  if (deleteError) fail(`Could not clear old appointments: ${deleteError.message}`);
  const { error: waitlistDeleteError } = await supabase
    .from("waitlist")
    .delete()
    .eq("client_id", clientId)
    .eq("garage_id", garage.id);
  if (waitlistDeleteError) fail(`Could not clear old waitlist entries: ${waitlistDeleteError.message}`);

  // --- Timeline ---------------------------------------------------------
  const appointmentIds = new Map<string, string>();
  const summary: string[] = [];

  for (const item of TIMELINE) {
    const service = serviceByName.get(item.service)!;
    const dateKey = openDay(item.dayOffset);
    let insertedId: string | null = null;
    let lastError = "";

    // The mechanic auto-assign trigger (0037) rejects a slot where every
    // mechanic is busy (23P01), e.g. clashing with real test bookings, so
    // walk outward from the preferred time until one fits.
    for (const time of candidateTimes(dateKey, service.duration_minutes, item.preferredTime)) {
      const start = zonedDateTimeToUtc(dateKey, time);
      const end = new Date(start.getTime() + service.duration_minutes * 60_000);
      const { data, error } = await supabase
        .from("appointments")
        .insert({
          client_id: clientId,
          garage_id: garage.id,
          service_id: service.id,
          vehicle_id: vehicleIds[item.vehicle],
          start_time: start.toISOString(),
          end_time: end.toISOString(),
          status: item.status,
          payment_mode: "on_site",
          terms_accepted_at: new Date().toISOString(),
        })
        .select("id")
        .single();
      if (data) {
        insertedId = data.id;
        summary.push(`  ${dateKey} ${time}  ${item.status.padEnd(9)}  ${item.service}`);
        break;
      }
      if (error?.code !== "23P01") fail(`Could not insert ${item.service} on ${dateKey}: ${error?.message}`);
      lastError = error.message;
    }

    if (!insertedId) fail(`No free slot for ${item.service} on ${dateKey} (${lastError}).`);
    appointmentIds.set(item.key, insertedId);
  }

  const reviewedAppointment = appointmentIds.get(REVIEW.on)!;
  const { error: reviewError } = await supabase.from("reviews").insert({
    appointment_id: reviewedAppointment,
    garage_id: garage.id,
    client_id: clientId,
    rating: REVIEW.rating,
    comment: REVIEW.comment,
  });
  if (reviewError) fail(`Could not insert the review: ${reviewError.message}`);

  // Spaced a few minutes apart so the thread reads in order.
  const threadStart = Date.now() - MESSAGES.length * 5 * 60_000;
  const { error: messagesError } = await supabase.from("messages").insert(
    MESSAGES.map((message, index) => ({
      appointment_id: appointmentIds.get(message.on)!,
      sender_id: message.from === "client" ? clientId : owner.id,
      body: message.body,
      created_at: new Date(threadStart + index * 5 * 60_000).toISOString(),
    }))
  );
  if (messagesError) fail(`Could not insert messages: ${messagesError.message}`);

  const waitlistDate = openDay(WAITLIST.dayOffset);
  const { error: waitlistError } = await supabase.from("waitlist").insert({
    garage_id: garage.id,
    client_id: clientId,
    service_id: serviceByName.get(WAITLIST.service)!.id,
    date: waitlistDate,
  });
  if (waitlistError) fail(`Could not insert the waitlist entry: ${waitlistError.message}`);

  console.log("=== Demo client seeded ===");
  console.log(`Garage:    ${garage.name} (${ownerEmail})`);
  console.log(`Client:    ${clientEmail}`);
  console.log(
    password
      ? `Password:  ${password}`
      : "Password:  unchanged (add --reset-password to set and print a new one)"
  );
  console.log(`Vehicles:  ${VEHICLES.map((vehicle) => `${vehicle.model} ${vehicle.license_plate}`).join(", ")}`);
  console.log("Appointments (Luxembourg time):");
  console.log(summary.join("\n"));
  console.log(`Review:    ${REVIEW.rating}★ on the ${TIMELINE.find((item) => item.key === REVIEW.on)!.service}`);
  console.log(`Messages:  ${MESSAGES.length} on the upcoming ${TIMELINE.find((entry) => entry.key === "tires")!.service}`);
  console.log(`Waitlist:  ${WAITLIST.service} on ${waitlistDate}`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
