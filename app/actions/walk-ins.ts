"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireGarageMember } from "@/lib/dal";
import { locales, parseLocale, type Locale } from "@/lib/i18n/config";
import { WalkInFormSchema, type WalkInFormState } from "@/lib/definitions";
import {
  APP_TIME_ZONE,
  dateKeyInAppZone,
  todayKeyInAppZone,
  zonedDateTimeToUtc,
} from "@/lib/timezone";

const FIVE_MINUTES = 5 * 60 * 1000;
// A walk-in logged a few minutes after the car actually rolled in is
// normal; anything earlier than this is almost certainly a mistake.
const PAST_TOLERANCE = 15 * 60 * 1000;

function revalidateLocalizedPath(path: string) {
  for (const locale of locales) {
    revalidatePath(`/${locale}${path}`);
  }
}

export type WalkInOptions = {
  services: { id: string; name: string; durationMinutes: number }[];
  mechanics: { id: string; name: string; busyUntil: string | null }[];
  customers: {
    kind: "garage_customer" | "client";
    id: string;
    name: string;
    detail: string | null;
    vehicles: { id: string; label: string }[];
  }[];
  brands: { id: string; name: string }[];
};

type VehicleRow = {
  id: string;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  brands: { name: string } | null;
};

function vehicleLabel(vehicle: VehicleRow) {
  return (
    [vehicle.license_plate, [vehicle.brands?.name, vehicle.model].filter(Boolean).join(" "), vehicle.year]
      .filter(Boolean)
      .join(" · ") || "—"
  );
}

/**
 * Everything the Quick walk-in modal needs, loaded when it opens (not on
 * every garage page render). Scoped by RLS to the caller's garage: its own
 * walk-in customers, registered clients who have booked there, and only
 * the vehicles that garage is allowed to see (0036/0038).
 */
export async function getWalkInOptions(lang: Locale): Promise<WalkInOptions> {
  const { garage } = await requireGarageMember(lang);
  const supabase = await createClient();
  const nowIso = new Date().toISOString();

  const [services, staff, owner, busy, walkIns, clientAppointments, brands] = await Promise.all([
    supabase
      .from("services")
      .select("id, name, duration_minutes")
      .eq("garage_id", garage.id)
      .order("name"),
    supabase.from("garage_staff").select("profiles(id, full_name)").eq("garage_id", garage.id),
    garage.owner_takes_bookings
      ? supabase.from("profiles").select("id, full_name").eq("id", garage.owner_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("appointments")
      .select("assigned_mechanic_id, end_time")
      .eq("garage_id", garage.id)
      .neq("status", "cancelled")
      .lte("start_time", nowIso)
      .gt("end_time", nowIso),
    supabase
      .from("garage_customers")
      .select("id, full_name, phone, email, vehicles(id, model, year, license_plate, brands(name))")
      .eq("garage_id", garage.id)
      .is("anonymized_at", null)
      .order("full_name"),
    supabase
      .from("appointments")
      .select(
        "client_id, client:profiles!appointments_client_id_fkey(full_name, email), vehicle:vehicles(id, model, year, license_plate, brands(name))"
      )
      .eq("garage_id", garage.id)
      .not("client_id", "is", null),
    supabase.from("brands").select("id, name").order("name"),
  ]);

  const busyUntil = new Map<string, string>();
  for (const row of busy.data ?? []) {
    if (!row.assigned_mechanic_id) continue;
    const current = busyUntil.get(row.assigned_mechanic_id);
    if (!current || row.end_time > current) busyUntil.set(row.assigned_mechanic_id, row.end_time);
  }
  const timeFormatter = new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

  const staffPeople = (staff.data ?? [])
    .map((row) => row.profiles as unknown as { id: string; full_name: string } | null)
    .filter((person): person is { id: string; full_name: string } => person !== null);
  const people = [...(owner.data ? [owner.data] : []), ...staffPeople];

  const clients = new Map<string, WalkInOptions["customers"][number]>();
  for (const row of (clientAppointments.data ?? []) as unknown as {
    client_id: string;
    client: { full_name: string; email: string } | null;
    vehicle: VehicleRow | null;
  }[]) {
    if (!row.client) continue;
    let entry = clients.get(row.client_id);
    if (!entry) {
      entry = { kind: "client", id: row.client_id, name: row.client.full_name, detail: row.client.email, vehicles: [] };
      clients.set(row.client_id, entry);
    }
    if (row.vehicle && !entry.vehicles.some((vehicle) => vehicle.id === row.vehicle!.id)) {
      entry.vehicles.push({ id: row.vehicle.id, label: vehicleLabel(row.vehicle) });
    }
  }

  return {
    services: (services.data ?? []).map((service) => ({
      id: service.id,
      name: service.name,
      durationMinutes: service.duration_minutes,
    })),
    mechanics: people.map((person) => {
      const until = busyUntil.get(person.id);
      return {
        id: person.id,
        name: person.full_name,
        busyUntil: until ? timeFormatter.format(new Date(until)) : null,
      };
    }),
    customers: [
      ...((walkIns.data ?? []) as unknown as {
        id: string;
        full_name: string;
        phone: string | null;
        email: string | null;
        vehicles: VehicleRow[];
      }[]).map((customer) => ({
        kind: "garage_customer" as const,
        id: customer.id,
        name: customer.full_name,
        detail: customer.phone ?? customer.email,
        vehicles: (customer.vehicles ?? []).map((vehicle) => ({ id: vehicle.id, label: vehicleLabel(vehicle) })),
      })),
      ...[...clients.values()].sort((a, b) => a.name.localeCompare(b.name)),
    ],
    brands: brands.data ?? [],
  };
}

/**
 * Books a walk-in as an already-confirmed job (no online payment). RLS
 * (0038) is the real gate: only garage members, only for this garage's
 * customers or returning clients, only status 'confirmed'. The mechanic
 * trigger (0037) assigns or validates the mechanic.
 */
export async function createWalkIn(
  state: WalkInFormState,
  formData: FormData
): Promise<WalkInFormState> {
  const lang = parseLocale(formData.get("lang"));
  const { garage, profile } = await requireGarageMember(lang);

  const validated = WalkInFormSchema.safeParse({
    customerKind: formData.get("customerKind"),
    customerId: formData.get("customerId") || undefined,
    newName: formData.get("newName") || undefined,
    newPhone: formData.get("newPhone") || undefined,
    newEmail: formData.get("newEmail") || undefined,
    vehicleChoice: formData.get("vehicleChoice") || undefined,
    plate: formData.get("plate") || undefined,
    brandId: formData.get("brandId") || undefined,
    model: formData.get("model") || undefined,
    vin: formData.get("vin") || undefined,
    serviceId: formData.get("serviceId"),
    mechanicId: formData.get("mechanicId") || undefined,
    when: formData.get("when") || undefined,
    time: formData.get("time") || undefined,
  });

  if (!validated.success) {
    return { errors: validated.error.flatten().fieldErrors };
  }
  const data = validated.data;
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("services")
    .select("id, name, duration_minutes")
    .eq("id", data.serviceId)
    .eq("garage_id", garage.id)
    .maybeSingle();
  if (!service) {
    return { errors: { serviceId: ["Choose one of your services."] } };
  }

  // Timing, in the garage's zone: "now" is rounded up to the next five
  // minutes; "at" is a wall-clock time today.
  const nowMs = Date.now();
  const today = todayKeyInAppZone();
  const start =
    data.when === "now"
      ? new Date(Math.ceil(nowMs / FIVE_MINUTES) * FIVE_MINUTES)
      : zonedDateTimeToUtc(today, data.time!);
  const end = new Date(start.getTime() + service.duration_minutes * 60_000);

  if (start.getTime() < nowMs - PAST_TOLERANCE) {
    return { errors: { time: ["That time has already passed."] } };
  }
  if (dateKeyInAppZone(start) !== today || dateKeyInAppZone(new Date(end.getTime() - 1)) !== today) {
    return { errors: { time: ["A walk-in has to fit within today. Use the calendar for later days."] } };
  }

  // Track what this call created, so a failed booking doesn't leave an
  // orphaned customer or vehicle behind.
  let createdCustomerId: string | null = null;
  let createdVehicleId: string | null = null;
  const cleanUp = async () => {
    if (createdVehicleId) await supabase.from("vehicles").delete().eq("id", createdVehicleId);
    if (createdCustomerId) await supabase.from("garage_customers").delete().eq("id", createdCustomerId);
  };

  let garageCustomerId: string | null = null;
  let clientId: string | null = null;
  let customerName: string;

  if (data.customerKind === "new") {
    const { data: customer, error } = await supabase
      .from("garage_customers")
      .insert({
        garage_id: garage.id,
        full_name: data.newName!,
        phone: data.newPhone ?? null,
        email: data.newEmail ?? null,
        created_by: profile.id,
      })
      .select("id, full_name")
      .single();
    if (error || !customer) {
      return { message: "Could not save the customer. Please try again." };
    }
    createdCustomerId = customer.id;
    garageCustomerId = customer.id;
    customerName = customer.full_name;
  } else if (data.customerKind === "garage_customer") {
    const { data: customer } = await supabase
      .from("garage_customers")
      .select("id, full_name")
      .eq("id", data.customerId!)
      .eq("garage_id", garage.id)
      .is("anonymized_at", null)
      .maybeSingle();
    if (!customer) return { errors: { customerId: ["Choose one of your customers."] } };
    garageCustomerId = customer.id;
    customerName = customer.full_name;
  } else {
    // Visible only for a client related to this garage (profiles RLS).
    const { data: client } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", data.customerId!)
      .maybeSingle();
    if (!client) return { errors: { customerId: ["Choose one of your customers."] } };
    clientId = client.id;
    customerName = client.full_name;
  }

  let vehicleId: string | null = null;
  if (data.vehicleChoice === "new") {
    const { data: vehicle, error } = await supabase
      .from("vehicles")
      .insert({
        garage_customer_id: garageCustomerId,
        brand_id: data.brandId ?? null,
        model: data.model ?? null,
        license_plate: data.plate ?? null,
        vin: data.vin ?? null,
      })
      .select("id")
      .single();
    if (error || !vehicle) {
      await cleanUp();
      return { message: "Could not save the vehicle. Please try again." };
    }
    createdVehicleId = vehicle.id;
    vehicleId = vehicle.id;
  } else if (data.vehicleChoice !== "none") {
    vehicleId = data.vehicleChoice;
  }

  const { data: appointment, error: bookingError } = await supabase
    .from("appointments")
    .insert({
      garage_id: garage.id,
      client_id: clientId,
      garage_customer_id: garageCustomerId,
      vehicle_id: vehicleId,
      service_id: service.id,
      assigned_mechanic_id: data.mechanicId ?? null,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: "confirmed",
    })
    .select("id, assigned_mechanic_id, mechanic:profiles!appointments_assigned_mechanic_id_fkey(full_name)")
    .single();

  if (bookingError || !appointment) {
    await cleanUp();
    if (bookingError?.code === "23P01") {
      return {
        message: data.mechanicId
          ? "That mechanic already has a job then. Pick someone else or Auto-assign."
          : "Every mechanic is busy then. Choose a later time today.",
      };
    }
    if (bookingError?.code === "42501") {
      return { message: "That customer or vehicle can't be booked from this garage." };
    }
    console.error("[walk-in] appointment insert failed:", bookingError);
    return { message: "Could not create the walk-in. Please try again." };
  }

  revalidateLocalizedPath("/garage/calendar");
  revalidateLocalizedPath("/garage/dashboard");
  revalidateLocalizedPath("/garage/clients");

  return {
    created: {
      appointmentId: appointment.id,
      startLabel: new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
        timeZone: APP_TIME_ZONE,
        hour: "2-digit",
        minute: "2-digit",
      }).format(start),
      mechanicName:
        (appointment.mechanic as unknown as { full_name: string } | null)?.full_name ?? null,
      customerName,
    },
  };
}

/**
 * GDPR erasure for a walk-in customer. Their jobs and invoices are kept
 * (legal record-keeping), so the row is anonymized rather than deleted --
 * the same approach as account deletion for registered clients.
 */
export async function anonymizeGarageCustomer(formData: FormData) {
  const lang = parseLocale(formData.get("lang"));
  const { garage } = await requireGarageMember(lang);
  const customerId = formData.get("customerId");
  if (typeof customerId !== "string" || !customerId) return;

  const supabase = await createClient();
  const { data: customer } = await supabase
    .from("garage_customers")
    .update({ full_name: "Deleted customer", phone: null, email: null, anonymized_at: new Date().toISOString() })
    .eq("id", customerId)
    .eq("garage_id", garage.id)
    .select("id")
    .maybeSingle();

  if (customer) {
    // Plates and VINs identify a person's car; the make/model alone don't.
    await supabase
      .from("vehicles")
      .update({ license_plate: null, vin: null })
      .eq("garage_customer_id", customer.id);
  }

  revalidateLocalizedPath("/garage/clients");
  redirect(`/${lang}/garage/clients?anonymized=${customer ? "1" : "0"}`);
}
