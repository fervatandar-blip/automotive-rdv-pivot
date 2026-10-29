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
  vehicle: {
    id: string;
    model: string | null;
    year: number | null;
    license_plate: string | null;
    plate_search: string | null;
    vin: string | null;
    brands: { name: string } | null;
  } | null;
};

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

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, client_id, garage_customer_id, start_time, status, services(name), client:profiles!appointments_client_id_fkey(full_name, email), walk_in:garage_customers(id, full_name, phone, email, anonymized_at), vehicle:vehicles(id, model, year, license_plate, plate_search, vin, brands(name))"
    )
    .eq("garage_id", garage.id)
    .neq("status", "pending_payment")
    .order("start_time", { ascending: false });

  const rows = (appointments ?? []) as unknown as AppointmentRow[];
  const formatter = new Intl.DateTimeFormat(dateLocale, {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  // One entry per client, each with the vehicles they've brought here and
  // that vehicle's visits (newest first, as the query orders them).
  const clients = new Map<string, DirectoryClient & { vehicleMap: Map<string, DirectoryVehicle> }>();
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
            appointmentCount: 0,
            vehicles: [],
            vehicleMap: new Map(),
          };
      clients.set(key, client);
    }
    client.appointmentCount += 1;

    if (!row.vehicle) continue;
    let vehicle = client.vehicleMap.get(row.vehicle.id);
    if (!vehicle) {
      vehicle = {
        id: row.vehicle.id,
        label:
          [row.vehicle.brands?.name, row.vehicle.model, row.vehicle.year].filter(Boolean).join(" ") ||
          d.vehicleFallback,
        licensePlate: row.vehicle.license_plate,
        plateSearch: row.vehicle.plate_search ?? "",
        vin: row.vehicle.vin,
        visits: [],
      };
      client.vehicleMap.set(row.vehicle.id, vehicle);
      client.vehicles.push(vehicle);
    }
    vehicle.visits.push({
      id: row.id,
      startTime: formatter.format(new Date(row.start_time)),
      serviceName: row.services?.name ?? d.serviceFallback,
      status: row.status,
    });
  }

  const directory: DirectoryClient[] = [...clients.values()]
    .map((client) => ({
      id: client.id,
      kind: client.kind,
      customerId: client.customerId,
      anonymized: client.anonymized,
      name: client.name,
      email: client.email,
      appointmentCount: client.appointmentCount,
      vehicles: client.vehicles,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

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
        <ClientDirectory clients={directory} d={d} lang={lang} initialQuery={typeof q === "string" ? q : ""} />
      </div>
    </div>
  );
}
