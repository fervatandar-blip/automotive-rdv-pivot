import type { Metadata } from "next";
import Link from "next/link";
import { CalendarPlus, Car, Clock, Pencil, Plus } from "lucide-react";
import { getAuthedUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { EmptyStateCard } from "@/components/empty-state-card";
import { LicensePlate } from "@/components/license-plate";
import { APP_TIME_ZONE } from "@/lib/timezone";
import { VehicleDialogButton } from "./vehicle-dialog";
import { DeleteVehicleButton } from "./delete-vehicle-button";
import {
  CLIENT_CARD,
  CLIENT_ICON_BUTTON,
  CLIENT_PILL_ICON,
  CLIENT_PRIMARY_BUTTON,
  CLIENT_TINTED_PILL,
  CLIENT_PAGE,
  CLIENT_PAGE_SUBTITLE,
  CLIENT_PAGE_TITLE,
} from "@/lib/client-ui";

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

// h-full + justify-between: cards in a grid row share one height, so the
// action footer lines up whether or not a card shows a VIN.
const CARD = `${CLIENT_CARD} flex h-full flex-col justify-between gap-5 p-5 sm:p-6`;

function formatServiceDate(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const { vehicles } = await getDictionary(resolveLocale(lang));
  return { title: vehicles.title };
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
    <div className={CLIENT_PAGE}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className={CLIENT_PAGE_TITLE}>{d.title}</h1>
            <p className={CLIENT_PAGE_SUBTITLE}>{d.subtitle}</p>
          </div>
          <VehicleDialogButton brands={brandList} d={d} className={CLIENT_PRIMARY_BUTTON}>
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
                  <div className="flex flex-col gap-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ink text-surface">
                          <Car aria-hidden className="h-6 w-6" strokeWidth={1.75} />
                        </div>
                        <div className="min-w-0">
                          <h2 className="truncate text-lg font-bold tracking-tight text-ink">{name}</h2>
                          <p className={`text-sm text-ink-muted ${vehicle.year ? "tabular-nums" : ""}`}>
                            {vehicle.year ?? d.noDetailsAdded}
                          </p>
                        </div>
                      </div>
                      {plate && <LicensePlate plate={plate} label={d.plateLabel} />}
                    </div>

                    {vehicle.vin && (
                      <dl className="min-w-0 text-sm">
                        <dt className="text-xs font-semibold text-ink-muted">
                          {d.vinLabel}
                        </dt>
                        <dd className="truncate tabular-nums text-ink">{vehicle.vin}</dd>
                      </dl>
                    )}

                    <p className="text-sm text-ink-muted">
                      {vehicleStats ? (
                        <>
                          <span className="font-medium text-ink">
                            {vehicleStats.visits === 1
                              ? d.serviceVisitsOne
                              : d.serviceVisitsMany.replace("{count}", String(vehicleStats.visits))}
                          </span>
                          {vehicleStats.lastServiceAt && (
                            <span className="mt-1 flex items-center gap-1.5">
                              <Clock aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                              {d.lastService.replace("{date}", formatServiceDate(vehicleStats.lastServiceAt, lang))}
                            </span>
                          )}
                        </>
                      ) : (
                        d.noServiceYet
                      )}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-hairline pt-5">
                    <Link
                      href={`/${lang}/garages?vehicle=${vehicle.id}`}
                      aria-label={d.bookServiceFor.replace("{vehicle}", name)}
                      className={CLIENT_TINTED_PILL}
                    >
                      <CalendarPlus aria-hidden className={CLIENT_PILL_ICON} strokeWidth={1.75} />
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
                        className={CLIENT_ICON_BUTTON}
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
