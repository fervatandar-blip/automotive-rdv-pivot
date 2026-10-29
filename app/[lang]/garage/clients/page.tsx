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
  client_id: string;
  start_time: string;
  status: string;
  services: { name: string } | null;
  client: { full_name: string; email: string } | null;
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
  searchParams: Promise<{ q?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { q } = await searchParams;
  const { garage } = await requireGarageMember(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageClients;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const supabase = await createClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, client_id, start_time, status, services(name), client:profiles!appointments_client_id_fkey(full_name, email), vehicle:vehicles(id, model, year, license_plate, plate_search, vin, brands(name))"
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
    if (!row.client) continue;

    let client = clients.get(row.client_id);
    if (!client) {
      client = {
        id: row.client_id,
        name: row.client.full_name || d.unnamedClient,
        email: row.client.email,
        appointmentCount: 0,
        vehicles: [],
        vehicleMap: new Map(),
      };
      clients.set(row.client_id, client);
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
        <ClientDirectory clients={directory} d={d} initialQuery={typeof q === "string" ? q : ""} />
      </div>
    </div>
  );
}
