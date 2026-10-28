"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGarageOwner } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import {
  GARAGE_LANGUAGES,
  GARAGE_PROFILE_SECTIONS,
  GarageCapabilitiesFormSchema,
  GarageDetailsFormSchema,
  GarageOnboardingFormSchema,
  type GarageOnboardingFormState,
  type GarageProfileFormState,
  type GarageProfileSection,
} from "@/lib/definitions";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

function revalidateGarageViews(garageId: string) {
  revalidateLocalizedPath("/garage/profile");
  revalidateLocalizedPath("/garage/dashboard");
  revalidateLocalizedPath("/garages");
  revalidateLocalizedPath(`/garages/${garageId}`);
}

function readCoordinate(formData: FormData, field: string): number | null {
  const value = formData.get(field);
  if (typeof value !== "string" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readLocation(formData: FormData) {
  const latitude = readCoordinate(formData, "latitude");
  const longitude = readCoordinate(formData, "longitude");
  // Both or neither: a half-set pin is meaningless, and out-of-range values
  // would only hit the DB check constraints with an unfriendly error.
  if (
    latitude === null ||
    longitude === null ||
    Math.abs(latitude) > 90 ||
    Math.abs(longitude) > 180
  ) {
    return { latitude: null, longitude: null };
  }
  return { latitude, longitude };
}

function readCapabilityFlags(formData: FormData) {
  return {
    ev_capable: formData.get("evCapable") === "on",
    mobile_service: formData.get("mobileService") === "on",
    emergency_service: formData.get("emergencyService") === "on",
    languages_spoken: formData
      .getAll("languages")
      .filter(
        (value): value is (typeof GARAGE_LANGUAGES)[number] =>
          typeof value === "string" &&
          (GARAGE_LANGUAGES as readonly string[]).includes(value)
      ),
  };
}

function readUuidList(formData: FormData, field: string) {
  return [
    ...new Set(
      formData
        .getAll(field)
        .filter(
          (value): value is string =>
            typeof value === "string" && UUID_PATTERN.test(value)
        )
    ),
  ];
}

/**
 * Weekly hours from the onboarding wizard's hours step, as availability
 * windows. Days marked closed, or with an empty/inverted range, produce no
 * window.
 */
function readWizardHours(formData: FormData) {
  const windows: { day_of_week: number; start_time: string; end_time: string }[] = [];

  for (let day = 0; day < 7; day++) {
    if (formData.get(`hours_${day}_closed`) === "on") continue;

    const open = formData.get(`hours_${day}_open`);
    const close = formData.get(`hours_${day}_close`);
    if (
      typeof open !== "string" ||
      typeof close !== "string" ||
      !TIME_PATTERN.test(open) ||
      !TIME_PATTERN.test(close) ||
      open >= close
    ) {
      continue;
    }

    windows.push({ day_of_week: day, start_time: open, end_time: close });
  }

  return windows;
}

async function replaceGarageCatalog(
  supabase: SupabaseClient,
  garageId: string,
  brandIds: string[],
  specialtyIds: string[]
) {
  const { error: brandDeleteError } = await supabase
    .from("garage_brands")
    .delete()
    .eq("garage_id", garageId);
  if (brandDeleteError) return brandDeleteError.message;

  if (brandIds.length > 0) {
    const { error } = await supabase
      .from("garage_brands")
      .insert(brandIds.map((brandId) => ({ garage_id: garageId, brand_id: brandId })));
    if (error) return error.message;
  }

  const { error: specialtyDeleteError } = await supabase
    .from("garage_specialties")
    .delete()
    .eq("garage_id", garageId);
  if (specialtyDeleteError) return specialtyDeleteError.message;

  if (specialtyIds.length > 0) {
    const { error } = await supabase.from("garage_specialties").insert(
      specialtyIds.map((specialtyId) => ({
        garage_id: garageId,
        specialty_id: specialtyId,
      }))
    );
    if (error) return error.message;
  }

  return null;
}

/**
 * First-run setup wizard only. An already-onboarded garage edits its
 * profile section by section through updateGarageProfile instead.
 */
export async function completeOnboarding(
  state: GarageOnboardingFormState,
  formData: FormData
): Promise<GarageOnboardingFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageOwner(lang);

  if (garage.platform_terms_accepted_at) {
    redirect(`/${lang}/garage/profile`);
  }

  const validatedFields = GarageOnboardingFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    address: formData.get("address") || undefined,
    city: formData.get("city") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    website: formData.get("website") || undefined,
    country: formData.get("country"),
    registrationNumber: formData.get("registrationNumber") || undefined,
    vatNumber: formData.get("vatNumber") || undefined,
    pricingCategory: formData.get("pricingCategory") || undefined,
    technicianCount: formData.get("technicianCount") || undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  if (formData.get("platformTermsAccepted") !== "on") {
    return {
      message: "You must accept the platform verification terms to continue.",
    };
  }

  const data = validatedFields.data;
  const supabase = await createClient();

  const { error } = await supabase
    .from("garages")
    .update({
      name: data.name,
      description: data.description ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      country: data.country,
      registration_number: data.registrationNumber ?? null,
      vat_number: data.vatNumber ?? null,
      pricing_category: data.pricingCategory ?? null,
      technician_count: data.technicianCount ?? null,
      ...readCapabilityFlags(formData),
      ...readLocation(formData),
      platform_terms_accepted_at: new Date().toISOString(),
    })
    .eq("id", garage.id);

  if (error) {
    return { message: error.message };
  }

  const catalogError = await replaceGarageCatalog(
    supabase,
    garage.id,
    readUuidList(formData, "brandIds"),
    readUuidList(formData, "specialtyIds")
  );
  if (catalogError) {
    return { message: catalogError };
  }

  // Opening hours live in one place: the availability table, which is what
  // booking slots are computed from (lib/availability.ts). The wizard's
  // hours step seeds it -- but only for a garage with no schedule yet, so it
  // never overwrites anything set up on /garage/availability.
  const { count: existingWindows } = await supabase
    .from("availability")
    .select("id", { count: "exact", head: true })
    .eq("garage_id", garage.id);

  const windows = readWizardHours(formData);
  if ((existingWindows ?? 0) === 0 && windows.length > 0) {
    const { error: hoursError } = await supabase
      .from("availability")
      .insert(windows.map((window) => ({ garage_id: garage.id, ...window })));
    if (hoursError) {
      console.error("[garage] could not seed availability:", hoursError);
    }
  }

  revalidateGarageViews(garage.id);
  revalidateLocalizedPath("/garage/availability");
  redirect(`/${lang}/garage/documents`);
}

/**
 * Saves one section of an onboarded garage's profile. Each section is its
 * own form on /garage/profile, so editing a phone number doesn't mean
 * re-submitting (and re-validating) the whole profile.
 */
export async function updateGarageProfile(
  state: GarageProfileFormState,
  formData: FormData
): Promise<GarageProfileFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageOwner(lang);

  if (!garage.platform_terms_accepted_at) {
    redirect(`/${lang}/garage/onboarding`);
  }

  const section = formData.get("section");
  if (!GARAGE_PROFILE_SECTIONS.includes(section as GarageProfileSection)) {
    return { message: "Unknown profile section." };
  }

  const supabase = await createClient();

  if (section === "catalog") {
    const catalogError = await replaceGarageCatalog(
      supabase,
      garage.id,
      readUuidList(formData, "brandIds"),
      readUuidList(formData, "specialtyIds")
    );
    if (catalogError) return { message: catalogError };
    revalidateGarageViews(garage.id);
    return { savedAt: Date.now() };
  }

  let update: Record<string, unknown>;

  if (section === "details") {
    // The country and registration number of an approved garage are what
    // its KYC review verified; the form shows them read-only and the DB
    // refuses changes (0034 trigger), so always keep the stored values.
    const identityLocked = garage.status === "approved";

    const validatedFields = GarageDetailsFormSchema.safeParse({
      name: formData.get("name"),
      description: formData.get("description") || undefined,
      address: formData.get("address") || undefined,
      city: formData.get("city") || undefined,
      phone: formData.get("phone") || undefined,
      email: formData.get("email") || undefined,
      website: formData.get("website") || undefined,
      country: identityLocked ? garage.country : formData.get("country"),
      registrationNumber: identityLocked
        ? garage.registration_number ?? undefined
        : formData.get("registrationNumber") || undefined,
      vatNumber: formData.get("vatNumber") || undefined,
    });

    if (!validatedFields.success) {
      return { errors: validatedFields.error.flatten().fieldErrors };
    }

    const data = validatedFields.data;
    update = {
      name: data.name,
      description: data.description ?? null,
      address: data.address ?? null,
      city: data.city ?? null,
      phone: data.phone ?? null,
      email: data.email ?? null,
      website: data.website ?? null,
      vat_number: data.vatNumber ?? null,
      ...(identityLocked
        ? {}
        : {
            country: data.country,
            registration_number: data.registrationNumber ?? null,
          }),
    };
  } else if (section === "location") {
    update = readLocation(formData);
  } else {
    const validatedFields = GarageCapabilitiesFormSchema.safeParse({
      pricingCategory: formData.get("pricingCategory") || undefined,
      technicianCount: formData.get("technicianCount") || undefined,
    });

    if (!validatedFields.success) {
      return { errors: validatedFields.error.flatten().fieldErrors };
    }

    update = {
      pricing_category: validatedFields.data.pricingCategory ?? null,
      technician_count: validatedFields.data.technicianCount ?? null,
      ...readCapabilityFlags(formData),
    };
  }

  const { error } = await supabase.from("garages").update(update).eq("id", garage.id);

  if (error) {
    return { message: error.message };
  }

  revalidateGarageViews(garage.id);
  return { savedAt: Date.now() };
}

export async function updateNotificationPreferences(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageOwner(lang);

  const supabase = await createClient();
  await supabase
    .from("garages")
    .update({
      notify_new_booking: formData.get("notifyNewBooking") === "on",
      notify_cancellation: formData.get("notifyCancellation") === "on",
      notify_message: formData.get("notifyMessage") === "on",
    })
    .eq("id", garage.id);

  revalidateLocalizedPath("/garage/notifications");
  redirect(`/${lang}/garage/notifications?saved=1`);
}
