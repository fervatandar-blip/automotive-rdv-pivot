/**
 * One-off local script: fully populates a test garage account (profile
 * fields, hours, brands, specialties, services, availability, and
 * placeholder documents) so it's ready to browse/book against without
 * manually filling out every onboarding form.
 *
 * Usage:
 *   npx tsx scripts/seed-test-garage.ts <garage-owner-email>
 *
 * WARNING: this uses the Supabase service-role key to bypass RLS entirely,
 * force-approves the garage and every document, and overwrites existing
 * services/availability/brand/specialty rows for the target garage. Local
 * and staging test data ONLY -- never point this at a production Supabase
 * project.
 */

import path from "node:path";
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(path.resolve(process.cwd(), ".env.local"));

// lib/supabase/admin.ts's createAdminClient can't be imported directly from
// a plain tsx/node script: that file starts with `import "server-only"`,
// which throws unconditionally unless resolved under Next's own bundler
// (the "react-server" export condition that silences it is never set here).
// This builds the exact same service-role client inline instead.
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

const BUCKET = "garage-documents";

// A minimal valid 1x1 transparent PNG (68 bytes), reused for every
// placeholder upload -- garage_documents only checks that file_path/
// file_name exist, never file contents.
const PLACEHOLDER_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64"
);

type OpeningHours = Record<
  number,
  { closed: true } | { closed: false; open: string; close: string }
>;

// Mon-Fri 08:00-18:00, Sat 09:00-13:00, Sun closed. Keys match the day
// index app/actions/garage.ts's readOpeningHours writes (0 = Sunday,
// matching JS Date#getDay()).
const OPENING_HOURS: OpeningHours = {
  0: { closed: true },
  1: { closed: false, open: "08:00", close: "18:00" },
  2: { closed: false, open: "08:00", close: "18:00" },
  3: { closed: false, open: "08:00", close: "18:00" },
  4: { closed: false, open: "08:00", close: "18:00" },
  5: { closed: false, open: "08:00", close: "18:00" },
  6: { closed: false, open: "09:00", close: "13:00" },
};

const BRAND_NAMES = ["Volkswagen", "BMW", "Audi", "Mercedes-Benz", "Toyota"];
const SPECIALTY_NAMES = [
  "General Maintenance",
  "Brakes",
  "Tires & Wheels",
  "Electrical & Diagnostics",
];

const SERVICES = [
  {
    name: "Oil change",
    description: "Full synthetic oil and filter replacement.",
    duration_minutes: 45,
    price: 89.0,
  },
  {
    name: "Brake inspection",
    description: "Front and rear brake pad, disc and fluid check.",
    duration_minutes: 30,
    price: 59.0,
  },
  {
    name: "Tire rotation",
    description: "Rotate and rebalance all four tires.",
    duration_minutes: 40,
    price: 49.0,
  },
  {
    name: "Full diagnostic",
    description: "Complete OBD scan and multi-point inspection.",
    duration_minutes: 60,
    price: 79.0,
  },
];

const DOCUMENTS: { documentType: string; category: string }[] = [
  { documentType: "company_registration", category: "business_legal" },
  { documentType: "vat_certificate", category: "business_legal" },
  { documentType: "exterior_photos", category: "operational" },
  { documentType: "interior_photos", category: "operational" },
  { documentType: "reception_photos", category: "operational" },
  { documentType: "logo_branding", category: "operational" },
];

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

async function main() {
  const email = process.argv[2];
  if (!email) {
    fail("Usage: npx tsx scripts/seed-test-garage.ts <garage-owner-email>");
  }

  const supabase = createAdminClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", email)
    .maybeSingle();

  if (profileError) fail(`Failed to look up profile: ${profileError.message}`);
  if (!profile) fail(`No profile found for email "${email}".`);

  const { data: garage, error: garageError } = await supabase
    .from("garages")
    .select("id, name")
    .eq("owner_id", profile.id)
    .maybeSingle();

  if (garageError) fail(`Failed to look up garage: ${garageError.message}`);
  if (!garage) {
    fail(
      `No garage owned by "${email}". This account needs to be admin_garage with an owned garage row first.`
    );
  }

  console.log(`Seeding garage "${garage.name}" (${garage.id}) owned by ${email}...\n`);

  // 2. Garage profile fields.
  const { error: updateError } = await supabase
    .from("garages")
    .update({
      description:
        "Full-service auto repair and maintenance garage in the heart of Luxembourg City, specializing in European makes and EV servicing.",
      address: "12 Rue de Bonnevoie",
      city: "Luxembourg City",
      phone: "+352 26 12 34 56",
      opening_hours: OPENING_HOURS,
      ev_capable: true,
      mobile_service: true,
      emergency_service: true,
      pricing_category: "standard",
      technician_count: 4,
      languages_spoken: ["French", "English", "German"],
      platform_terms_accepted_at: new Date().toISOString(),
      status: "approved",
    })
    .eq("id", garage.id);

  if (updateError) fail(`Failed to update garage profile: ${updateError.message}`);

  // 3. Brands & specialties.
  const { data: brands, error: brandsError } = await supabase
    .from("brands")
    .select("id, name")
    .in("name", BRAND_NAMES);
  if (brandsError) fail(`Failed to look up brands: ${brandsError.message}`);

  const { data: specialties, error: specialtiesError } = await supabase
    .from("specialties")
    .select("id, name")
    .in("name", SPECIALTY_NAMES);
  if (specialtiesError) fail(`Failed to look up specialties: ${specialtiesError.message}`);

  await supabase.from("garage_brands").delete().eq("garage_id", garage.id);
  if (brands && brands.length > 0) {
    const { error } = await supabase
      .from("garage_brands")
      .insert(brands.map((brand) => ({ garage_id: garage.id, brand_id: brand.id })));
    if (error) fail(`Failed to insert garage_brands: ${error.message}`);
  }

  await supabase.from("garage_specialties").delete().eq("garage_id", garage.id);
  if (specialties && specialties.length > 0) {
    const { error } = await supabase.from("garage_specialties").insert(
      specialties.map((specialty) => ({
        garage_id: garage.id,
        specialty_id: specialty.id,
      }))
    );
    if (error) fail(`Failed to insert garage_specialties: ${error.message}`);
  }

  // 4. Services.
  await supabase.from("services").delete().eq("garage_id", garage.id);
  const { data: insertedServices, error: servicesError } = await supabase
    .from("services")
    .insert(SERVICES.map((service) => ({ ...service, garage_id: garage.id })))
    .select("id");
  if (servicesError) fail(`Failed to insert services: ${servicesError.message}`);

  // 5. Weekly availability, mirroring the opening hours set in step 2.
  const availabilityRows: {
    garage_id: string;
    day_of_week: number;
    start_time: string;
    end_time: string;
  }[] = [];
  for (const [dayKey, hours] of Object.entries(OPENING_HOURS)) {
    if (hours.closed) continue;
    availabilityRows.push({
      garage_id: garage.id,
      day_of_week: Number(dayKey),
      start_time: hours.open,
      end_time: hours.close,
    });
  }

  await supabase.from("availability").delete().eq("garage_id", garage.id);
  const { error: availabilityError } = await supabase
    .from("availability")
    .insert(availabilityRows);
  if (availabilityError) fail(`Failed to insert availability: ${availabilityError.message}`);

  // 6. Placeholder documents, uploaded and approved directly.
  let documentsUploaded = 0;
  for (const { documentType, category } of DOCUMENTS) {
    const filePath = `${garage.id}/${category}/${documentType}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, PLACEHOLDER_PNG, {
        contentType: "image/png",
        upsert: true,
      });
    if (uploadError) {
      console.error(`  ! Upload failed for ${documentType}: ${uploadError.message}`);
      continue;
    }

    await supabase
      .from("garage_documents")
      .delete()
      .eq("garage_id", garage.id)
      .eq("document_type", documentType);

    const { error: docError } = await supabase.from("garage_documents").insert({
      garage_id: garage.id,
      category,
      document_type: documentType,
      file_path: filePath,
      file_name: `${documentType}.png`,
      status: "approved",
    });
    if (docError) {
      console.error(`  ! garage_documents insert failed for ${documentType}: ${docError.message}`);
      continue;
    }

    documentsUploaded++;
  }

  // 7. Summary.
  console.log("=== Seed complete ===");
  console.log(`Garage:      ${garage.name} (${garage.id})`);
  console.log(`Status:      approved`);
  console.log(`Brands:      ${brands?.length ?? 0} linked (${BRAND_NAMES.join(", ")})`);
  console.log(`Specialties: ${specialties?.length ?? 0} linked (${SPECIALTY_NAMES.join(", ")})`);
  console.log(`Services:    ${insertedServices?.length ?? 0} created`);
  console.log(`Availability: ${availabilityRows.length} weekly windows`);
  console.log(`Documents:   ${documentsUploaded}/${DOCUMENTS.length} uploaded & approved`);
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
