"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getAuthedUser } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import { VehicleFormSchema, type VehicleFormState } from "@/lib/definitions";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

function revalidateVehiclePages() {
  // The dashboard lists vehicles too.
  revalidateLocalizedPath("/vehicles");
  revalidateLocalizedPath("/dashboard");
}

/**
 * Adds a vehicle, or updates one when the form carries an `id`. On update,
 * an emptied field is cleared (null), so a mistyped VIN can be removed.
 * RLS ("Clients manage their own vehicles") limits both to the caller's
 * own rows; the explicit client_id filter keeps that intent visible here.
 */
export async function saveVehicle(
  state: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const lang = parseLocale(formData.get("lang"));
  const user = await getAuthedUser(lang);
  const rawId = formData.get("id");
  const id = typeof rawId === "string" && rawId ? rawId : null;

  const validatedFields = VehicleFormSchema.safeParse({
    brandId: formData.get("brandId") || undefined,
    model: formData.get("model") || undefined,
    year: formData.get("year") || undefined,
    licensePlate: formData.get("licensePlate") || undefined,
    vin: formData.get("vin") || undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { brandId, model, year, licensePlate, vin } = validatedFields.data;
  const fields = {
    brand_id: brandId ?? null,
    model: model ?? null,
    year: year ?? null,
    license_plate: licensePlate ?? null,
    vin: vin ?? null,
  };
  const supabase = await createClient();

  if (id) {
    const { data, error } = await supabase
      .from("vehicles")
      .update(fields)
      .eq("id", id)
      .eq("client_id", user.id)
      .select("id");
    if (error) return { message: error.message };
    // Zero rows: not this user's vehicle, or it was deleted meanwhile.
    if (!data?.length) return { message: "notFound" };
  } else {
    const { error } = await supabase.from("vehicles").insert({ client_id: user.id, ...fields });
    if (error) return { message: error.message };
  }

  revalidateVehiclePages();
  return { saved: true };
}

export async function deleteVehicle(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const user = await getAuthedUser(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  // appointments.vehicle_id is ON DELETE SET NULL: past bookings stay but
  // no longer show which vehicle they were for (the confirm text says so).
  const supabase = await createClient();
  await supabase
    .from("vehicles")
    .delete()
    .eq("id", id)
    .eq("client_id", user.id);

  revalidateVehiclePages();
}
