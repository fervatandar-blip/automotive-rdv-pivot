"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireGarageMember } from "@/lib/dal";
import { locales, parseLocale } from "@/lib/i18n/config";
import {
  ClientDetailsFormSchema,
  CustomerVehicleFormSchema,
  type ClientDetailsFormState,
  type CustomerVehicleFormState,
} from "@/lib/definitions";
import { normalizePlate } from "@/lib/vehicle-identifiers";

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

function text(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function echo(formData: FormData, fields: string[]) {
  const values: Record<string, string> = {};
  for (const field of fields) {
    const value = formData.get(field);
    if (typeof value === "string") values[field] = value;
  }
  return values;
}

const DETAIL_FIELDS = ["name", "email", "phone", "notes", "preferredContactTime", "isVip"];

/**
 * Saves a client's CRM details from the directory panel:
 *   - for the garage's own customers: name, phone and email on
 *     garage_customers (registered clients manage their own profile);
 *   - for everyone: notes, VIP flag and preferred contact time in
 *     garage_client_notes (0042), plus a garage-kept phone for registered
 *     clients, whose RDV profile has none.
 * RLS is the gate: only this garage's members, only about its own
 * customers or clients who have booked with it.
 */
export async function saveClientDetails(
  state: ClientDetailsFormState,
  formData: FormData
): Promise<ClientDetailsFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage, profile } = await requireGarageMember(lang);
  const values = echo(formData, DETAIL_FIELDS);

  const validated = ClientDetailsFormSchema.safeParse({
    kind: formData.get("kind"),
    subjectId: formData.get("subjectId"),
    name: text(formData, "name"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    notes: text(formData, "notes"),
    preferredContactTime: text(formData, "preferredContactTime"),
    isVip: formData.get("isVip") === "on",
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, values };
  }
  const data = validated.data;
  const supabase = await createClient();

  if (data.kind === "walk_in") {
    const { data: updated, error } = await supabase
      .from("garage_customers")
      .update({ full_name: data.name!, phone: data.phone ?? null, email: data.email ?? null })
      .eq("id", data.subjectId)
      .eq("garage_id", garage.id)
      .is("anonymized_at", null)
      .select("id")
      .maybeSingle();
    if (error || !updated) {
      if (error) console.error("[clients] customer update failed:", error);
      return { message: "saveFailed", values };
    }
  }

  const subject =
    data.kind === "walk_in"
      ? { garage_customer_id: data.subjectId }
      : { client_id: data.subjectId };
  const { error: notesError } = await supabase.from("garage_client_notes").upsert(
    {
      garage_id: garage.id,
      ...subject,
      notes: data.notes ?? null,
      is_vip: data.isVip,
      preferred_contact_time: data.preferredContactTime ?? null,
      phone: data.kind === "client" ? data.phone ?? null : null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: data.kind === "walk_in" ? "garage_id,garage_customer_id" : "garage_id,client_id" }
  );
  if (notesError) {
    console.error("[clients] notes upsert failed:", notesError);
    return { message: "saveFailed", values };
  }

  revalidateLocalizedPath("/garage/clients");
  return { saved: true };
}

const VEHICLE_FIELDS = ["plate", "brandId", "model", "year", "vin"];

/**
 * Adds a vehicle to one of the garage's own customers from the CRM panel.
 * Registered clients add their own vehicles in RDV, so this never targets
 * them. A plate or VIN already in this garage's directory is refused, so a
 * returning car isn't split across two records.
 */
export async function addCustomerVehicle(
  state: CustomerVehicleFormState,
  formData: FormData
): Promise<CustomerVehicleFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const values = echo(formData, VEHICLE_FIELDS);

  const validated = CustomerVehicleFormSchema.safeParse({
    customerId: formData.get("customerId"),
    plate: text(formData, "plate"),
    brandId: text(formData, "brandId"),
    model: text(formData, "model"),
    year: text(formData, "year"),
    vin: text(formData, "vin"),
  });
  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors, values };
  }
  const data = validated.data;
  const supabase = await createClient();

  const { data: customer } = await supabase
    .from("garage_customers")
    .select("id")
    .eq("id", data.customerId)
    .eq("garage_id", garage.id)
    .is("anonymized_at", null)
    .maybeSingle();
  if (!customer) return { message: "saveFailed", values };

  const plateSearch = data.plate ? normalizePlate(data.plate) : "";
  const [plateMatch, vinMatch] = await Promise.all([
    plateSearch
      ? supabase.from("vehicles").select("id").eq("plate_search", plateSearch).limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
    data.vin
      ? supabase.from("vehicles").select("id").eq("vin", data.vin).limit(1)
      : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  if ((plateMatch.data ?? []).length > 0) return { errors: { plate: ["plateExists"] }, values };
  if ((vinMatch.data ?? []).length > 0) return { errors: { vin: ["vinExists"] }, values };

  const { error } = await supabase.from("vehicles").insert({
    garage_customer_id: customer.id,
    brand_id: data.brandId ?? null,
    model: data.model ?? null,
    year: data.year ?? null,
    license_plate: data.plate ?? null,
    vin: data.vin ?? null,
  });
  if (error) {
    console.error("[clients] vehicle insert failed:", error);
    return { message: "saveFailed", values };
  }

  revalidateLocalizedPath("/garage/clients");
  return { added: true };
}
