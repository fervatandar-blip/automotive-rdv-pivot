"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGarageOwner } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import {
  GarageOnboardingFormSchema,
  type GarageOnboardingFormState,
} from "@/lib/definitions";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

type OpeningHours = Record<
  string,
  { closed: true } | { closed: false; open: string; close: string }
>;

function readCoordinate(formData: FormData, field: string): number | null {
  const value = formData.get(field);
  if (typeof value !== "string" || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function readOpeningHours(formData: FormData): OpeningHours {
  const hours: OpeningHours = {};

  for (let day = 0; day < 7; day++) {
    const closed = formData.get(`hours_${day}_closed`) === "on";
    if (closed) {
      hours[day] = { closed: true };
      continue;
    }

    const open = formData.get(`hours_${day}_open`);
    const close = formData.get(`hours_${day}_close`);
    hours[day] = {
      closed: false,
      open: typeof open === "string" && open ? open : "09:00",
      close: typeof close === "string" && close ? close : "18:00",
    };
  }

  return hours;
}

export async function completeOnboarding(
  state: GarageOnboardingFormState,
  formData: FormData
): Promise<GarageOnboardingFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageOwner(lang);

  const validatedFields = GarageOnboardingFormSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description") || undefined,
    address: formData.get("address") || undefined,
    city: formData.get("city") || undefined,
    phone: formData.get("phone") || undefined,
    email: formData.get("email") || undefined,
    vatNumber: formData.get("vatNumber") || undefined,
    pricingCategory: formData.get("pricingCategory") || undefined,
    technicianCount: formData.get("technicianCount") || undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  if (formData.get("platformTermsAccepted") !== "on") {
    return {
      message:
        "You must accept the platform verification terms to continue.",
    };
  }

  const {
    name,
    description,
    address,
    city,
    phone,
    email,
    vatNumber,
    pricingCategory,
    technicianCount,
  } = validatedFields.data;

  const evCapable = formData.get("evCapable") === "on";
  const mobileService = formData.get("mobileService") === "on";
  const emergencyService = formData.get("emergencyService") === "on";
  const languagesSpoken = formData.getAll("languages").filter(
    (value): value is string => typeof value === "string"
  );
  const brandIds = formData.getAll("brandIds").filter(
    (value): value is string => typeof value === "string"
  );
  const specialtyIds = formData.getAll("specialtyIds").filter(
    (value): value is string => typeof value === "string"
  );

  const supabase = await createClient();

  const { error } = await supabase
    .from("garages")
    .update({
      name,
      description: description ?? null,
      address: address ?? null,
      city: city ?? null,
      phone: phone ?? null,
      email: email ?? null,
      vat_number: vatNumber ?? null,
      pricing_category: pricingCategory ?? null,
      technician_count: technicianCount ?? null,
      ev_capable: evCapable,
      mobile_service: mobileService,
      emergency_service: emergencyService,
      languages_spoken: languagesSpoken,
      opening_hours: readOpeningHours(formData),
      latitude: readCoordinate(formData, "latitude"),
      longitude: readCoordinate(formData, "longitude"),
      platform_terms_accepted_at: new Date().toISOString(),
    })
    .eq("id", garage.id);

  if (error) {
    return { message: error.message };
  }

  await supabase.from("garage_brands").delete().eq("garage_id", garage.id);
  if (brandIds.length > 0) {
    await supabase.from("garage_brands").insert(
      brandIds.map((brandId) => ({ garage_id: garage.id, brand_id: brandId }))
    );
  }

  await supabase
    .from("garage_specialties")
    .delete()
    .eq("garage_id", garage.id);
  if (specialtyIds.length > 0) {
    await supabase.from("garage_specialties").insert(
      specialtyIds.map((specialtyId) => ({
        garage_id: garage.id,
        specialty_id: specialtyId,
      }))
    );
  }

  revalidateLocalizedPath("/garage/onboarding");
  revalidateLocalizedPath("/dashboard");
  revalidateLocalizedPath("/garages");

  const wasFirstRun = !garage.platform_terms_accepted_at;
  redirect(
    wasFirstRun ? `/${lang}/garage/documents` : `/${lang}/garage/onboarding?saved=1`
  );
}
