/**
 * One-off local script: creates a real, bookable-loop-ready appointment
 * directly (bypassing Stripe checkout entirely), so the booking loop
 * (client books -> garage sees it) can be verified without setting up
 * Stripe Connect.
 *
 * Usage:
 *   npx tsx scripts/seed-test-appointment.ts <garage-owner-email> <client-email>
 *
 * Requires the garage to already be seeded via scripts/seed-test-garage.ts
 * (needs at least one service and one weekly availability window).
 *
 * WARNING: this uses the Supabase service-role key to bypass RLS entirely
 * and writes a 'confirmed' appointment with no real payment behind it.
 * Local and staging test data ONLY -- never point this at a production
 * Supabase project.
 */

import path from "node:path";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));

// Same reasoning as scripts/seed-test-garage.ts: lib/supabase/admin.ts's
// createAdminClient starts with `import "server-only"`, which throws
// unconditionally outside Next's own server bundling. Building the same
// service-role client inline instead of re-attempting that import.
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing from .env.local"
    );
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

const TEST_CLIENT_PASSWORD = "TestPass123!";
const TEST_VEHICLE_LICENSE_PLATE = "TE 1234";
const TEST_VEHICLE_BRAND_NAME = "Volkswagen";

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Next date on/after tomorrow whose day-of-week matches `dayOfWeek`. */
function nextDateForDayOfWeek(dayOfWeek: number): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const diff = (dayOfWeek - tomorrow.getDay() + 7) % 7;
  const target = new Date(tomorrow);
  target.setDate(tomorrow.getDate() + diff);
  return target;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

function combineDateAndTime(date: Date, hhmm: string): Date {
  const [hours, minutes] = hhmm.split(":").map(Number);
  const result = new Date(date);
  result.setHours(hours, minutes, 0, 0);
  return result;
}

async function main() {
  const [garageOwnerEmail, clientEmail] = process.argv.slice(2);
  if (!garageOwnerEmail || !clientEmail) {
    fail(
      "Usage: npx tsx scripts/seed-test-appointment.ts <garage-owner-email> <client-email>"
    );
  }

  const supabase = createAdminClient();

  // 1. Garage lookup (same as scripts/seed-test-garage.ts).
  const { data: ownerProfile, error: ownerError } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", garageOwnerEmail)
    .maybeSingle();
  if (ownerError) fail(`Failed to look up garage owner: ${ownerError.message}`);
  if (!ownerProfile) fail(`No profile found for garage owner email "${garageOwnerEmail}".`);

  const { data: garage, error: garageError } = await supabase
    .from("garages")
    .select("id, name")
    .eq("owner_id", ownerProfile.id)
    .maybeSingle();
  if (garageError) fail(`Failed to look up garage: ${garageError.message}`);
  if (!garage) fail(`No garage owned by "${garageOwnerEmail}".`);

  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("garage_id", garage.id)
    .order("name");
  const { data: availability } = await supabase
    .from("availability")
    .select("day_of_week, start_time, end_time")
    .eq("garage_id", garage.id)
    .order("day_of_week");

  if (!services || services.length === 0) {
    fail(
      `Garage "${garage.name}" has no services yet -- run scripts/seed-test-garage.ts first.`
    );
  }
  if (!availability || availability.length === 0) {
    fail(
      `Garage "${garage.name}" has no availability yet -- run scripts/seed-test-garage.ts first.`
    );
  }

  const service = services[0];
  const window = availability[0];

  // 2. Client lookup / creation.
  const { data: existingClient, error: clientLookupError } = await supabase
    .from("profiles")
    .select("id, role")
    .eq("email", clientEmail)
    .maybeSingle();
  if (clientLookupError) fail(`Failed to look up client: ${clientLookupError.message}`);

  let clientId: string;
  if (existingClient) {
    if (existingClient.role !== "client") {
      fail(
        `Profile "${clientEmail}" exists but has role "${existingClient.role}", not "client".`
      );
    }
    clientId = existingClient.id;
    console.log(`Using existing client profile for ${clientEmail}.`);
  } else {
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: clientEmail,
      password: TEST_CLIENT_PASSWORD,
      email_confirm: true,
      user_metadata: { role: "client", full_name: "Test Client" },
    });
    if (createError || !created.user) {
      fail(`Failed to create client user: ${createError?.message ?? "unknown error"}`);
    }
    clientId = created.user.id;
    console.log(`Created new client account for ${clientEmail} (password: ${TEST_CLIENT_PASSWORD}).`);
  }

  // 3. Pick a service + weekly window, compute a real near-future slot.
  const slotDate = nextDateForDayOfWeek(window.day_of_week);
  const startTime = combineDateAndTime(slotDate, window.start_time.slice(0, 5));
  const endTime = addMinutes(startTime, service.duration_minutes);
  const windowEnd = combineDateAndTime(slotDate, window.end_time.slice(0, 5));

  if (endTime > windowEnd) {
    fail(
      `Service "${service.name}" (${service.duration_minutes} min) doesn't fit inside the ` +
        `${window.start_time}-${window.end_time} window -- pick a shorter seeded service.`
    );
  }

  // 5. One vehicle for the test client, reused across re-runs via its
  // marker license plate rather than accumulating a new row every time.
  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("name", TEST_VEHICLE_BRAND_NAME)
    .maybeSingle();

  const { data: existingVehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("client_id", clientId)
    .eq("license_plate", TEST_VEHICLE_LICENSE_PLATE)
    .maybeSingle();

  let vehicleId: string;
  if (existingVehicle) {
    vehicleId = existingVehicle.id;
  } else {
    const { data: insertedVehicle, error: vehicleError } = await supabase
      .from("vehicles")
      .insert({
        client_id: clientId,
        brand_id: brand?.id ?? null,
        model: "Golf",
        year: 2019,
        license_plate: TEST_VEHICLE_LICENSE_PLATE,
      })
      .select("id")
      .single();
    if (vehicleError) fail(`Failed to insert vehicle: ${vehicleError.message}`);
    vehicleId = insertedVehicle.id;
  }

  // 4. The appointment itself. Delete any prior test appointment between
  // this exact client/garage pair first, so re-running the script doesn't
  // trip the garage's no-overlap exclusion constraint.
  await supabase
    .from("appointments")
    .delete()
    .eq("garage_id", garage.id)
    .eq("client_id", clientId);

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .insert({
      garage_id: garage.id,
      client_id: clientId,
      service_id: service.id,
      vehicle_id: vehicleId,
      start_time: startTime.toISOString(),
      end_time: endTime.toISOString(),
      status: "confirmed",
      repair_stage: "received",
      terms_accepted_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (appointmentError) fail(`Failed to insert appointment: ${appointmentError.message}`);

  // 6. Summary.
  console.log("\n=== Test appointment created ===");
  console.log(`Appointment: ${appointment.id}`);
  console.log(`Client:      ${clientEmail}`);
  console.log(`Garage:      ${garage.name}`);
  console.log(`Service:     ${service.name} (${service.duration_minutes} min)`);
  console.log(`Start time:  ${startTime.toString()}`);
  console.log(`Status:      confirmed / repair_stage: received`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
