/**
 * One-off local script: gives a test garage a test client with two
 * vehicles and a few past/upcoming appointments, so the client directory's
 * plate/VIN search and vehicle history have something to show.
 *
 * Usage:
 *   node scripts/seed-test-clients.ts <garage-owner-email> [client-email]
 *
 * The client defaults to demo-client@rdv.invalid (.invalid can never
 * receive mail). Re-running reuses the client and vehicles and only adds
 * appointments that don't exist yet.
 *
 * WARNING: service-role key, writes confirmed/completed appointments with
 * no payment behind them. Test data only; delete before launch.
 */

import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));

// Same reasoning as scripts/seed-test-garage.ts: lib/supabase/admin.ts
// starts with `import "server-only"`, which throws outside Next's bundler.
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

const VEHICLES = [
  { brand: "Volkswagen", model: "Golf", year: 2019, license_plate: "LU-1234", vin: "WVWZZZ1KZAW123456" },
  { brand: "BMW", model: "320d", year: 2021, license_plate: "AB 5678", vin: null },
];

// Wall-clock times in Luxembourg with their explicit UTC offset (CEST +02
// until 25 Oct 2026, CET +01 after), so the result doesn't depend on the
// machine running the script. All inside the seeded Mon-Fri 08-18 hours.
const APPOINTMENTS = [
  { vehicle: 0, service: "Oil change", start: "2026-09-15T09:00:00+02:00", status: "completed" },
  { vehicle: 0, service: "Brake inspection", start: "2026-10-20T14:00:00+02:00", status: "completed" },
  { vehicle: 1, service: "Full diagnostic", start: "2026-10-27T10:00:00+01:00", status: "cancelled" },
  { vehicle: 1, service: "Tire rotation", start: "2026-11-10T11:00:00+01:00", status: "confirmed" },
] as const;

async function main() {
  const [ownerEmail, clientEmailArg] = process.argv.slice(2);
  if (!ownerEmail) fail("Usage: node scripts/seed-test-clients.ts <garage-owner-email> [client-email]");
  const clientEmail = (clientEmailArg ?? "demo-client@rdv.invalid").toLowerCase();

  const supabase = createAdminClient();

  const { data: owner } = await supabase.from("profiles").select("id").eq("email", ownerEmail).maybeSingle();
  if (!owner) fail(`No profile for ${ownerEmail}.`);
  const { data: garage } = await supabase.from("garages").select("id, name").eq("owner_id", owner.id).maybeSingle();
  if (!garage) fail(`${ownerEmail} owns no garage.`);

  const { data: services } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("garage_id", garage.id);
  const serviceByName = new Map((services ?? []).map((service) => [service.name, service]));
  if (serviceByName.size === 0) fail(`Garage "${garage.name}" has no services -- run seed-test-garage.ts first.`);

  // Client account (created once; password printed only on creation).
  let clientId: string;
  let password: string | null = null;
  const { data: existingClient } = await supabase.from("profiles").select("id, role").eq("email", clientEmail).maybeSingle();
  if (existingClient) {
    if (existingClient.role !== "client") fail(`${clientEmail} exists with role ${existingClient.role}, not client.`);
    clientId = existingClient.id;
  } else {
    password = `Rdv-${randomBytes(18).toString("base64url")}1a`;
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: clientEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: "Demo Client" },
    });
    if (error || !created.user) fail(`Could not create ${clientEmail}: ${error?.message}`);
    clientId = created.user.id;
  }

  // Vehicles, reused by plate across re-runs.
  const vehicleIds: string[] = [];
  for (const vehicle of VEHICLES) {
    const { data: brand } = await supabase.from("brands").select("id").eq("name", vehicle.brand).maybeSingle();
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

  let created = 0;
  for (const appointment of APPOINTMENTS) {
    const service = serviceByName.get(appointment.service);
    if (!service) fail(`Service "${appointment.service}" not found at ${garage.name}.`);
    const start = new Date(appointment.start);
    const end = new Date(start.getTime() + service.duration_minutes * 60_000);

    const { data: existing } = await supabase
      .from("appointments")
      .select("id")
      .eq("garage_id", garage.id)
      .eq("client_id", clientId)
      .eq("start_time", start.toISOString())
      .maybeSingle();
    if (existing) continue;

    const { error } = await supabase.from("appointments").insert({
      client_id: clientId,
      garage_id: garage.id,
      service_id: service.id,
      vehicle_id: vehicleIds[appointment.vehicle],
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: appointment.status,
      terms_accepted_at: new Date().toISOString(),
    });
    if (error) fail(`Could not insert ${appointment.service} on ${appointment.start}: ${error.message}`);
    created++;
  }

  console.log("=== Test client seeded ===");
  console.log(`Garage:       ${garage.name}`);
  console.log(`Client:       ${clientEmail}${password ? `  (password: ${password})` : "  (existing account)"}`);
  console.log(`Vehicles:     ${VEHICLES.map((vehicle) => `${vehicle.model} ${vehicle.license_plate}${vehicle.vin ? ` / VIN ${vehicle.vin}` : ""}`).join(", ")}`);
  console.log(`Appointments: ${created} added (${APPOINTMENTS.length} total in the seed)`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
