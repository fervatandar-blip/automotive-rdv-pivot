import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { APP_TIME_ZONE, todayKeyInAppZone, zonedStartOfDay } from "@/lib/timezone";
import {
  directoryStats,
  parseDirectoryFilter,
  parseDirectorySort,
  type DirectoryClient,
  type DirectoryVehicle,
} from "@/lib/client-directory";
import { ClientDirectory } from "./client-directory";
import { DirectoryStats } from "./directory-stats";
import { ClientDrawer, type ClientNotes, type TimelineEntry } from "./client-drawer";

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

type NotesRow = ClientNotes & { client_id: string | null; garage_customer_id: string | null };

const VEHICLE_SELECT = "id, model, year, license_plate, plate_search, vin, brands(name)";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function GarageClientsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    q?: string;
    anonymized?: string;
    filter?: string;
    sort?: string;
    client?: string;
    edit?: string;
  }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const query = await searchParams;
  const { garage } = await requireGarageMember(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageClients;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-GB";
  const supabase = await createClient();
  // Request time, for last/next visit (same pattern as the dashboard).
  const now = new Date().getTime();
  // This calendar month in the garage's zone, for "Active this month".
  const monthKey = todayKeyInAppZone().slice(0, 7);
  const monthStart = zonedStartOfDay(`${monthKey}-01`).getTime();
  const [monthYear, monthNumber] = monthKey.split("-").map(Number);
  const nextMonthStart = zonedStartOfDay(
    monthNumber === 12 ? `${monthYear + 1}-01-01` : `${monthYear}-${String(monthNumber + 1).padStart(2, "0")}-01`
  ).getTime();

  const [{ data: appointments }, { data: customers }, { data: notesData }] = await Promise.all([
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
    supabase
      .from("garage_client_notes")
      .select("client_id, garage_customer_id, notes, is_vip, preferred_contact_time, phone, updated_at")
      .eq("garage_id", garage.id),
  ]);

  const notesByKey = new Map<string, NotesRow>();
  for (const row of (notesData ?? []) as NotesRow[]) {
    notesByKey.set(row.client_id ? `client:${row.client_id}` : `walk_in:${row.garage_customer_id}`, row);
  }

  const rows = (appointments ?? []) as unknown as AppointmentRow[];
  const visitFormatter = new Intl.DateTimeFormat(dateLocale, {
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
        [vehicle.brands?.name, vehicle.model, vehicle.year].filter(Boolean).join(" ") || d.vehicleFallback,
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

  function newEntry(
    key: string,
    kind: DirectoryClient["kind"],
    subjectId: string,
    name: string,
    email: string | null,
    phone: string | null,
    anonymized: boolean
  ): ClientEntry {
    const notes = notesByKey.get(key);
    // A registered client's phone is the one the garage noted (0042).
    const shownPhone = kind === "client" ? notes?.phone ?? null : phone;
    return {
      id: key,
      kind,
      subjectId,
      anonymized,
      name,
      email,
      phone: shownPhone,
      phoneDigits: (shownPhone ?? "").replace(/\D/g, ""),
      isVip: notes?.is_vip ?? false,
      hasNotes: Boolean(notes?.notes || notes?.preferred_contact_time),
      activeThisMonth: false,
      appointmentCount: 0,
      visitCount: 0,
      lastVisit: null,
      nextVisit: null,
      vehicles: [],
      vehicleMap: new Map(),
    };
  }

  // One entry per client, with the vehicles they've brought here and each
  // vehicle's visits (newest first, as the query orders them).
  const clients = new Map<string, ClientEntry>();
  for (const row of rows) {
    // Registered clients and walk-in customers live in different tables,
    // so key them by kind to keep ids from ever colliding.
    const key = row.client ? `client:${row.client_id}` : row.walk_in ? `walk_in:${row.walk_in.id}` : null;
    if (!key) continue;

    let client = clients.get(key);
    if (!client) {
      client = row.client
        ? newEntry(key, "client", row.client_id!, row.client.full_name || d.unnamedClient, row.client.email, null, false)
        : newEntry(
            key,
            "walk_in",
            row.walk_in!.id,
            row.walk_in!.full_name,
            row.walk_in!.email,
            row.walk_in!.phone,
            Boolean(row.walk_in!.anonymized_at)
          );
      clients.set(key, client);
    }
    client.appointmentCount += 1;
    const startMs = new Date(row.start_time).getTime();
    if (row.status !== "cancelled" && startMs <= now) {
      client.visitCount += 1;
      if (!client.lastVisit || row.start_time > client.lastVisit) client.lastVisit = row.start_time;
    }
    if (row.status !== "cancelled" && startMs >= monthStart && startMs < nextMonthStart) {
      client.activeThisMonth = true;
    }
    if ((row.status === "pending" || row.status === "confirmed") && startMs > now) {
      if (!client.nextVisit || row.start_time < client.nextVisit) client.nextVisit = row.start_time;
    }

    if (!row.vehicle) continue;
    ensureVehicle(client, row.vehicle).visits.push({
      id: row.id,
      startTime: visitFormatter.format(new Date(row.start_time)),
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
      client = newEntry(key, "walk_in", customer.id, customer.full_name, customer.email, customer.phone, false);
      clients.set(key, client);
    }
    for (const vehicle of customer.vehicles ?? []) {
      ensureVehicle(client, vehicle);
    }
  }

  const directory: DirectoryClient[] = [...clients.values()].map((entry) => ({
    id: entry.id,
    kind: entry.kind,
    subjectId: entry.subjectId,
    anonymized: entry.anonymized,
    name: entry.name,
    email: entry.email,
    phone: entry.phone,
    phoneDigits: entry.phoneDigits,
    isVip: entry.isVip,
    hasNotes: entry.hasNotes,
    activeThisMonth: entry.activeThisMonth,
    appointmentCount: entry.appointmentCount,
    visitCount: entry.visitCount,
    lastVisit: entry.lastVisit,
    nextVisit: entry.nextVisit,
    vehicles: entry.vehicles,
  }));

  // Detail panel (?client=walk_in:<id> / client:<id>).
  const selectedKey = typeof query.client === "string" ? query.client : null;
  const selected = selectedKey ? directory.find((client) => client.id === selectedKey) ?? null : null;
  let drawer: React.ReactNode = null;
  if (selected && UUID_PATTERN.test(selected.subjectId)) {
    const subjectColumn = selected.kind === "client" ? "client_id" : "garage_customer_id";
    const [{ data: history }, { data: invoices }, { data: brands }] = await Promise.all([
      supabase
        .from("appointments")
        .select(
          "id, start_time, end_time, status, services(name), mechanic:profiles!appointments_assigned_mechanic_id_fkey(full_name), vehicle:vehicles(license_plate, model, brands(name))"
        )
        .eq("garage_id", garage.id)
        .eq(subjectColumn, selected.subjectId)
        .neq("status", "pending_payment")
        .order("start_time", { ascending: false })
        .limit(200),
      supabase
        .from("invoices")
        .select("id, invoice_number, amount, currency, issued_at, file_path")
        .eq("garage_id", garage.id)
        .eq(subjectColumn, selected.subjectId)
        .order("issued_at", { ascending: false }),
      selected.kind === "walk_in" && !selected.anonymized
        ? supabase.from("brands").select("id, name").order("name")
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const invoiceRows = (invoices ?? []) as {
      id: string;
      invoice_number: string;
      amount: number;
      currency: string;
      issued_at: string;
      file_path: string;
    }[];
    // One batched Storage call; createSignedUrls preserves input order.
    const signedUrls = new Map<string, string>();
    if (invoiceRows.length > 0) {
      const { data: signed } = await supabase.storage
        .from("invoices")
        .createSignedUrls(invoiceRows.map((invoice) => invoice.file_path), 60 * 10);
      signed?.forEach((result, index) => {
        if (result.signedUrl) signedUrls.set(invoiceRows[index].id, result.signedUrl);
      });
    }

    const timeline: TimelineEntry[] = [
      ...((history ?? []) as unknown as {
        id: string;
        start_time: string;
        end_time: string;
        status: string;
        services: { name: string } | null;
        mechanic: { full_name: string } | null;
        vehicle: { license_plate: string | null; model: string | null; brands: { name: string } | null } | null;
      }[]).map(
        (job): TimelineEntry => ({
          kind: "job",
          id: job.id,
          at: job.start_time,
          endAt: job.end_time,
          status: job.status,
          title: job.services?.name ?? d.serviceFallback,
          mechanic: job.mechanic?.full_name ?? null,
          plate: job.vehicle?.license_plate ?? null,
          vehicle: [job.vehicle?.brands?.name, job.vehicle?.model].filter(Boolean).join(" ") || null,
        })
      ),
      ...invoiceRows.map(
        (invoice): TimelineEntry => ({
          kind: "invoice",
          id: invoice.id,
          at: invoice.issued_at,
          number: invoice.invoice_number,
          amount: Number(invoice.amount),
          currency: invoice.currency,
          url: signedUrls.get(invoice.id) ?? null,
        })
      ),
    ].sort((a, b) => b.at.localeCompare(a.at));

    const closeParams = new URLSearchParams();
    for (const key of ["q", "filter", "sort"] as const) {
      const value = query[key];
      if (typeof value === "string" && value) closeParams.set(key, value);
    }
    const closeHref = `/${lang}/garage/clients${closeParams.size > 0 ? `?${closeParams}` : ""}`;

    drawer = (
      <ClientDrawer
        client={selected}
        notes={notesByKey.get(selected.id) ?? null}
        timeline={timeline}
        brands={brands ?? []}
        closeHref={closeHref}
        startInEdit={query.edit === "1"}
        lang={lang}
        dateLocale={dateLocale}
        d={d}
        addClientD={dictionary.addClient}
        statusLabels={dictionary.common.appointmentStatus}
      />
    );
  }

  const initialQuery = typeof query.q === "string" ? query.q : "";

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-4 py-8 dark:bg-zinc-950 sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">{d.title}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{d.subtitle}</p>
        </div>
        <DirectoryStats stats={directoryStats(directory)} d={d} />
        {query.anonymized === "1" && (
          <p
            role="status"
            className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300"
          >
            {d.anonymized}
          </p>
        )}
        {/* Keyed on the search so "Open in directory" after adding a client
            re-seeds it even when this page is already open. */}
        <ClientDirectory
          key={initialQuery}
          clients={directory}
          d={d}
          walkInD={dictionary.walkIn}
          lang={lang}
          dateLocale={dateLocale}
          initialQuery={initialQuery}
          initialFilter={parseDirectoryFilter(query.filter)}
          initialSort={parseDirectorySort(query.sort)}
          selectedId={selected?.id ?? null}
        />
      </div>
      {drawer}
    </div>
  );
}
