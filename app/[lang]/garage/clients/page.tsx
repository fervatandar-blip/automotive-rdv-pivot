import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { APP_TIME_ZONE } from "@/lib/timezone";
import {
  ClientDirectory,
  type DirectoryClient,
  type DirectoryVehicle,
} from "./client-directory";

type VehicleRow = {
  id: string;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  plate_search: string | null;
  vin: string | null;
  brands: { name: string } | null;
};

type AppointmentRow = {
  id: string;
  client_id: string | null;
  garage_customer_id: string | null;
  start_time: string;
  status: string;
  services: { name: string } | null;
  client: { full_name: string; email: string } | null;
  // Walk-in customer (0038), when the job isn't for a registered client.
  walk_in: { id: string; full_name: string; phone: string | null; email: string | null; anonymized_at: string | null } | null;
  // Visible only for vehicles booked with this garage (vehicles RLS,
  // migration 0036); null when the appointment had no vehicle.
  vehicle: VehicleRow | null;
};

// The garage's own customers, including those saved with "Add client" who
// have never booked (and vehicles added to a customer after their visits).
type GarageCustomerRow = {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  vehicles: VehicleRow[] | null;
};

const VEHICLE_SELECT = "id, model, year, license_plate, plate_search, vin, brands(name)";

export default async function GarageClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; anonymized?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { q, anonymized } = await searchParams;
  const { garage } = await requireGarageMember(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageClients;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const supabase = await createClient();

  const [{ data: appointments }, { data: customers }] = await Promise.all([
    supabase
      .from("appointments")
      .select(
        `id, client_id, garage_customer_id, start_time, status, services(name), client:profiles!appointments_client_id_fkey(full_name, email), walk_in:garage_customers(id, full_name, phone, email, anonymized_at), vehicle:vehicles(${VEHICLE_SELECT})`
      )
      .eq("garage_id", garage.id)
      .neq("status", "pending_payment")
      .order("start_time", { ascending: false }),
    // Anonymized customers only matter through their history, which the
    // appointments query above already brings in.
    supabase
      .from("garage_customers")
      .select(`id, full_name, phone, email, vehicles(${VEHICLE_SELECT})`)
      .eq("garage_id", garage.id)
      .is("anonymized_at", null),
  ]);

  const rows = (appointments ?? []) as unknown as AppointmentRow[];
  const formatter = new Intl.DateTimeFormat(dateLocale, {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  type ClientEntry = DirectoryClient & { vehicleMap: Map<string, DirectoryVehicle> };

  function toDirectoryVehicle(vehicle: VehicleRow): DirectoryVehicle {
    return {
      id: vehicle.id,
      label:
        [vehicle.brands?.name, vehicle.model, vehicle.year].filter(Boolean).join(" ") ||
        d.vehicleFallback,
      licensePlate: vehicle.license_plate,
      plateSearch: vehicle.plate_search ?? "",
      vin: vehicle.vin,
      visits: [],
    };
  }

  function ensureVehicle(client: ClientEntry, vehicle: VehicleRow) {
    let entry = client.vehicleMap.get(vehicle.id);
    if (!entry) {
      entry = toDirectoryVehicle(vehicle);
      client.vehicleMap.set(vehicle.id, entry);
      client.vehicles.push(entry);
    }
    return entry;
  }

  // One entry per client, each with the vehicles they've brought here and
  // that vehicle's visits (newest first, as the query orders them).
  const clients = new Map<string, ClientEntry>();
  for (const row of rows) {
    // Registered clients and walk-in customers live in different tables,
    // so key them by kind to keep ids from ever colliding.
    const key = row.client ? `client:${row.client_id}` : row.walk_in ? `walk_in:${row.walk_in.id}` : null;
    if (!key) continue;

    let client = clients.get(key);
    if (!client) {
      client = row.client
        ? {
            id: key,
            kind: "client",
            name: row.client.full_name || d.unnamedClient,
            email: row.client.email,
            phoneDigits: "",
            appointmentCount: 0,
            vehicles: [],
            vehicleMap: new Map(),
          }
        : {
            id: key,
            kind: "walk_in",
            customerId: row.walk_in!.id,
            anonymized: Boolean(row.walk_in!.anonymized_at),
            name: row.walk_in!.full_name,
            email: [row.walk_in!.phone, row.walk_in!.email].filter(Boolean).join(" · "),
            phoneDigits: (row.walk_in!.phone ?? "").replace(/\D/g, ""),
            appointmentCount: 0,
            vehicles: [],
            vehicleMap: new Map(),
          };
      clients.set(key, client);
    }
    client.appointmentCount += 1;

    if (!row.vehicle) continue;
    ensureVehicle(client, row.vehicle).visits.push({
      id: row.id,
      startTime: formatter.format(new Date(row.start_time)),
      serviceName: row.services?.name ?? d.serviceFallback,
      status: row.status,
    });
  }

  // Garage customers with no history yet, and vehicles on file that
  // haven't been brought in for a job.
  for (const customer of (customers ?? []) as unknown as GarageCustomerRow[]) {
    const key = `walk_in:${customer.id}`;
    let client = clients.get(key);
    if (!client) {
      client = {
        id: key,
        kind: "walk_in",
        customerId: customer.id,
        anonymized: false,
        name: customer.full_name,
        email: [customer.phone, customer.email].filter(Boolean).join(" · "),
        phoneDigits: (customer.phone ?? "").replace(/\D/g, ""),
        appointmentCount: 0,
        vehicles: [],
        vehicleMap: new Map(),
      };
      clients.set(key, client);
    }
    for (const vehicle of customer.vehicles ?? []) {
      ensureVehicle(client, vehicle);
    }
  }

  const directory: DirectoryClient[] = [...clients.values()]
    .map((client) => ({
      id: client.id,
      kind: client.kind,
      customerId: client.customerId,
      anonymized: client.anonymized,
      name: client.name,
      email: client.email,
      phoneDigits: client.phoneDigits,
      appointmentCount: client.appointmentCount,
      vehicles: client.vehicles,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const initialQuery = typeof q === "string" ? q : "";

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-4 py-10 dark:bg-black sm:px-12 sm:py-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{d.title}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{d.subtitle}</p>
        </div>
        {anonymized === "1" && (
          <p role="status" className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
            {d.anonymized}
          </p>
        )}
        {/* Keyed on the query so "Open in directory" after adding a client
            re-seeds the search even when this page is already open. */}
        <ClientDirectory
          key={initialQuery}
          clients={directory}
          d={d}
          lang={lang}
          initialQuery={initialQuery}
          statusLabels={dictionary.common.appointmentStatus}
        />
      </div>
    </div>
  );
}
