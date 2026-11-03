"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGarageMember } from "@/lib/dal";
import { locales, parseLocale, type Locale } from "@/lib/i18n/config";
import {
  GarageCustomerFormSchema,
  type GarageCustomerFormState,
} from "@/lib/definitions";
import { normalizePlate } from "@/lib/vehicle-identifiers";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

const CUSTOMER_FIELDS = ["name", "phone", "email", "plate", "brandId", "model", "year", "vin"];

function submittedValues(formData: FormData, fields: string[]) {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

function optionalField(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

/**
 * Makes for the Add client modal's picker, loaded when the modal opens
 * (it lives in the top bar of every garage page, so it shouldn't cost a
 * query on every render). brands is a public lookup table.
 */
export async function getBrandOptions(lang: Locale): Promise<{ id: string; name: string }[]> {
  await requireGarageMember(lang);
  const supabase = await createClient();
  const { data } = await supabase.from("brands").select("id, name").order("name");
  return data ?? [];
}

/**
 * Saves one of the garage's own customers (garage_customers, 0038) -- and
 * optionally their vehicle -- without booking anything. RLS is the real
 * gate: garage members can only write customers and vehicles of their own
 * garage.
 *
 * Duplicate vehicles are refused rather than silently creating a second
 * record: the plate/VIN check runs against every vehicle this garage can
 * see (its own customers' plus registered clients who booked here, vehicles
 * RLS 0036/0038), so a returning car is found by search instead of being
 * split across two customer cards.
 */
export async function createGarageCustomer(
  state: GarageCustomerFormState,
  formData: FormData
): Promise<GarageCustomerFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage, profile } = await requireGarageMember(lang);

  const values = submittedValues(formData, CUSTOMER_FIELDS);
  const validated = GarageCustomerFormSchema.safeParse({
    name: formData.get("name") ?? "",
    phone: optionalField(formData, "phone"),
    email: optionalField(formData, "email"),
    plate: optionalField(formData, "plate"),
    brandId: optionalField(formData, "brandId"),
    model: optionalField(formData, "model"),
    year: optionalField(formData, "year"),
    vin: optionalField(formData, "vin"),
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, values };
  }

  const data = validated.data;
  const hasVehicle = Boolean(data.plate || data.model);
  const supabase = await createClient();

  if (hasVehicle) {
    const plateSearch = data.plate ? normalizePlate(data.plate) : "";
    const [plateMatch, vinMatch] = await Promise.all([
      plateSearch
        ? supabase.from("vehicles").select("id").eq("plate_search", plateSearch).limit(1)
        : Promise.resolve({ data: [] as { id: string }[] }),
      data.vin
        ? supabase.from("vehicles").select("id").eq("vin", data.vin).limit(1)
        : Promise.resolve({ data: [] as { id: string }[] }),
    ]);
    if ((plateMatch.data ?? []).length > 0) {
      return { errors: { plate: ["plateExists"] }, values };
    }
    if ((vinMatch.data ?? []).length > 0) {
      return { errors: { vin: ["vinExists"] }, values };
    }
  }

  const { data: customer, error: customerError } = await supabase
    .from("garage_customers")
    .insert({
      garage_id: garage.id,
      full_name: data.name,
      phone: data.phone ?? null,
      email: data.email ?? null,
      created_by: profile.id,
    })
    .select("id, full_name")
    .single();

  if (customerError || !customer) {
    console.error("[add-client] customer insert failed:", customerError);
    return { message: "saveFailed", values };
  }

  if (hasVehicle) {
    const { error: vehicleError } = await supabase.from("vehicles").insert({
      garage_customer_id: customer.id,
      brand_id: data.brandId ?? null,
      model: data.model ?? null,
      year: data.year ?? null,
      license_plate: data.plate ?? null,
      vin: data.vin ?? null,
    });

    if (vehicleError) {
      // Don't leave a customer without the car the user just entered; they
      // resubmit the whole form.
      await supabase.from("garage_customers").delete().eq("id", customer.id);
      console.error("[add-client] vehicle insert failed:", vehicleError);
      return { message: "saveFailed", values };
    }
  }

  revalidateLocalizedPath("/garage/clients");
  return { created: { name: customer.full_name } };
}
