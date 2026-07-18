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

export async function addVehicle(
  state: VehicleFormState,
  formData: FormData
): Promise<VehicleFormState> {
  const lang = parseLocale(formData.get("lang"));
  const user = await getAuthedUser(lang);

  const validatedFields = VehicleFormSchema.safeParse({
    brandId: formData.get("brandId") || undefined,
    model: formData.get("model") || undefined,
    year: formData.get("year") || undefined,
    licensePlate: formData.get("licensePlate") || undefined,
  });

  if (!validatedFields.success) {
    return { errors: validatedFields.error.flatten().fieldErrors };
  }

  const { brandId, model, year, licensePlate } = validatedFields.data;
  const supabase = await createClient();

  const { error } = await supabase.from("vehicles").insert({
    client_id: user.id,
    brand_id: brandId ?? null,
    model: model ?? null,
    year: year ?? null,
    license_plate: licensePlate ?? null,
  });

  if (error) {
    return { message: error.message };
  }

  revalidateLocalizedPath("/vehicles");
  return {};
}

export async function deleteVehicle(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const user = await getAuthedUser(lang);
  const id = formData.get("id");

  if (typeof id !== "string" || !id) {
    return;
  }

  const supabase = await createClient();
  await supabase
    .from("vehicles")
    .delete()
    .eq("id", id)
    .eq("client_id", user.id);

  revalidateLocalizedPath("/vehicles");
}
