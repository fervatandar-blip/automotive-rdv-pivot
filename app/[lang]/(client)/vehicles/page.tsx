import Link from "next/link";
import { CalendarPlus, Car, Pencil, Plus } from "lucide-react";
import { getAuthedUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { EmptyStateCard } from "@/components/empty-state-card";
import { LicensePlate } from "@/components/license-plate";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { VehicleDialogButton } from "./vehicle-dialog";
import { DeleteVehicleButton } from "./delete-vehicle-button";

type VehicleRow = {
  id: string;
  brand_id: string | null;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  vin: string | null;
  brands: { name: string } | null;
};

type ServiceStats = { visits: number; lastServiceAt: string | null };

const CARD =
  "flex flex-col gap-4 rounded-xl border border-zinc-200/80 bg-white p-5 dark:border-zinc-800/60 dark:bg-zinc-950/40";
const PRIMARY_BUTTON =
  "inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-full bg-brand-600 px-5 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-2 dark:bg-brand-500 dark:hover:bg-brand-600 dark:focus-visible:ring-offset-black";
const BOOK_BUTTON =
  "inline-flex h-8 items-center gap-1.5 rounded-full bg-brand-50 px-3.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:bg-brand-500/10 dark:text-brand-300 dark:hover:bg-brand-500/20";
const ICON_BUTTON =
  "inline-flex h-8 w-8 items-center justify-center rounded-full text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50";

function formatServiceDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function VehiclesPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const user = await getAuthedUser(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.vehicles;
  const supabase = await createClient();

  const [{ data: vehicles }, { data: brands }, { data: completed }] = await Promise.all([
    supabase
      .from("vehicles")
      .select("id, brand_id, model, year, license_plate, vin, brands(name)")
      .eq("client_id", user.id)
      .order("created_at", { ascending: false }),
    supabase.from("brands").select("id, name").order("name"),
    // A "service visit" is a completed appointment for that vehicle.
    supabase
      .from("appointments")
      .select("vehicle_id, start_time")
      .eq("client_id", user.id)
      .eq("status", "completed")
      .not("vehicle_id", "is", null),
  ]);

  const rows = (vehicles ?? []) as unknown as VehicleRow[];
  const brandList = brands ?? [];

  const stats = new Map<string, ServiceStats>();
  for (const visit of completed ?? []) {
    if (!visit.vehicle_id) continue;
    const entry = stats.get(visit.vehicle_id) ?? { visits: 0, lastServiceAt: null };
    entry.visits += 1;
    if (!entry.lastServiceAt || visit.start_time > entry.lastServiceAt) {
      entry.lastServiceAt = visit.start_time;
    }
    stats.set(visit.vehicle_id, entry);
  }

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-3xl">
              {d.title}
            </h1>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.subtitle}</p>
          </div>
          <VehicleDialogButton brands={brandList} d={d} className={PRIMARY_BUTTON}>
            <Plus aria-hidden className="h-4 w-4" strokeWidth={2} />
            {d.addVehicleButton}
          </VehicleDialogButton>
        </header>

        {rows.length > 0 ? (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {rows.map((vehicle) => {
              const name =
                [vehicle.brands?.name, vehicle.model].filter(Boolean).join(" ") || d.vehicleFallback;
              const plate = vehicle.license_plate?.trim();
              const vehicleStats = stats.get(vehicle.id);

              return (
                <li key={vehicle.id} className={CARD}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400">
                        <Car aria-hidden className="h-5 w-5" strokeWidth={1.5} />
                      </div>
                      <div className="min-w-0">
                        <h2 className="truncate font-semibold text-black dark:text-zinc-50">{name}</h2>
                        <p className="text-sm text-zinc-500 dark:text-zinc-400">
                          {vehicle.year ?? d.noDetailsAdded}
                        </p>
                      </div>
                    </div>
                    {plate && <LicensePlate plate={plate} label={d.plateLabel} />}
                  </div>

                  {vehicle.vin && (
                    <dl className="min-w-0 text-sm">
                      <dt className="text-xs font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
                        {d.vinLabel}
                      </dt>
                      <dd className="truncate font-mono text-zinc-800 dark:text-zinc-200">{vehicle.vin}</dd>
                    </dl>
                  )}

                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {vehicleStats ? (
                      <>
                        <span className="font-medium text-black dark:text-zinc-50">
                          {vehicleStats.visits === 1
                            ? d.serviceVisitsOne
                            : d.serviceVisitsMany.replace("{count}", String(vehicleStats.visits))}
                        </span>
                        {vehicleStats.lastServiceAt && (
                          <>
                            {" · "}
                            {d.lastService.replace("{date}", formatServiceDate(vehicleStats.lastServiceAt, lang))}
                          </>
                        )}
                      </>
                    ) : (
                      d.noServiceYet
                    )}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/60">
                    <Link
                      href={`/${lang}/garages?vehicle=${vehicle.id}`}
                      aria-label={d.bookServiceFor.replace("{vehicle}", name)}
                      className={BOOK_BUTTON}
                    >
                      <CalendarPlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      {d.bookService}
                    </Link>
                    <div className="ml-auto flex items-center gap-1">
                      <VehicleDialogButton
                        vehicle={{
                          id: vehicle.id,
                          brandId: vehicle.brand_id,
                          model: vehicle.model,
                          year: vehicle.year,
                          licensePlate: vehicle.license_plate,
                          vin: vehicle.vin,
                        }}
                        brands={brandList}
                        d={d}
                        ariaLabel={d.editVehicleNamed.replace("{vehicle}", name)}
                        className={ICON_BUTTON}
                      >
                        <Pencil aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                      </VehicleDialogButton>
                      <DeleteVehicleButton vehicleId={vehicle.id} vehicleName={name} d={d} />
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyStateCard icon={Car} title={d.noVehiclesTitle} description={d.noVehiclesDescription} />
        )}
      </div>
    </div>
  );
}
