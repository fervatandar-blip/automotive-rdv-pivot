import Link from "next/link";
import { Suspense } from "react";
import { Search, MapPin } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { GarageDiscoveryMap } from "@/components/garage-discovery-map";
import { StyledSelect } from "@/components/styled-select";
import { CheckboxChip } from "@/components/checkbox-chip";
import { NearMeButton } from "@/components/near-me-button";
import { averageRating, formatRating } from "@/lib/ratings";
import { haversineDistanceKm, formatDistanceKm } from "@/lib/geo";

const RADIUS_OPTIONS_KM = [5, 10, 25, 50];

type GarageRow = {
  id: string;
  name: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  ev_capable: boolean;
  mobile_service: boolean;
  emergency_service: boolean;
  pricing_category: string | null;
  services: { id: string }[];
  reviews: { rating: number }[];
};

type GarageWithDistance = GarageRow & { distanceKm: number | null };

type SearchParams = {
  q?: string;
  city?: string;
  ev?: string;
  mobile?: string;
  emergency?: string;
  minRating?: string;
  sort?: string;
  lat?: string;
  lng?: string;
  radius?: string;
};

export default async function GaragesPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<SearchParams>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageDiscovery;
  // Public discovery page -- no auth required to browse. Booking itself is
  // gated inside bookAppointment (app/actions/appointments.ts).
  const filters = await searchParams;

  const supabase = await createClient();

  // No brand or specialty filters: garages don't maintain that data after
  // onboarding, so the filters would go stale.
  const { data: garages } = await supabase
    .from("garages")
    .select(
      "id, name, city, latitude, longitude, ev_capable, mobile_service, emergency_service, pricing_category, services(id), reviews(rating)"
    )
    .eq("status", "approved")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const rows = (garages ?? []) as unknown as GarageRow[];
  const cities = Array.from(
    new Set(rows.map((garage) => garage.city).filter((city): city is string => !!city))
  ).sort();

  const minRating = filters.minRating ? Number(filters.minRating) : 0;
  const query = filters.q?.trim().toLowerCase() ?? "";

  const originLat = filters.lat ? Number(filters.lat) : null;
  const originLng = filters.lng ? Number(filters.lng) : null;
  const hasOrigin =
    originLat !== null &&
    originLng !== null &&
    Number.isFinite(originLat) &&
    Number.isFinite(originLng);
  const radiusKm = filters.radius ? Number(filters.radius) : null;

  const withDistance: GarageWithDistance[] = rows.map((garage) => ({
    ...garage,
    distanceKm:
      hasOrigin && garage.latitude !== null && garage.longitude !== null
        ? haversineDistanceKm(originLat, originLng, garage.latitude, garage.longitude)
        : null,
  }));

  const filtered = withDistance.filter((garage) => {
    if (query && !garage.name.toLowerCase().includes(query)) return false;
    if (filters.city && garage.city !== filters.city) return false;
    if (filters.ev === "1" && !garage.ev_capable) return false;
    if (filters.mobile === "1" && !garage.mobile_service) return false;
    if (filters.emergency === "1" && !garage.emergency_service) return false;
    if (minRating > 0) {
      const average = averageRating(garage.reviews.map((review) => review.rating));
      if (average === null || average < minRating) return false;
    }
    if (hasOrigin && radiusKm !== null) {
      if (garage.distanceKm === null || garage.distanceKm > radiusKm) return false;
    }
    return true;
  });

  const effectiveSort = filters.sort ?? (hasOrigin ? "distance" : "name");

  const sorted = [...filtered].sort((a, b) => {
    if (effectiveSort === "distance" && hasOrigin) {
      const distanceA = a.distanceKm ?? Infinity;
      const distanceB = b.distanceKm ?? Infinity;
      return distanceA - distanceB;
    }
    if (effectiveSort === "rating") {
      const ratingA = averageRating(a.reviews.map((review) => review.rating)) ?? -1;
      const ratingB = averageRating(b.reviews.map((review) => review.rating)) ?? -1;
      return ratingB - ratingA;
    }
    return a.name.localeCompare(b.name);
  });

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          {d.title}
        </h1>

        <form
          method="GET"
          className="flex flex-col gap-8 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-4">
            {hasOrigin && (
              <>
                <input type="hidden" name="lat" value={filters.lat} />
                <input type="hidden" name="lng" value={filters.lng} />
              </>
            )}

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <div className="flex flex-1 flex-col overflow-hidden rounded-full border border-black/[.08] dark:border-white/[.145] sm:flex-row sm:items-center">
                <div className="flex flex-1 items-center gap-2 px-4 py-2.5">
                  <Search
                    className="h-4 w-4 shrink-0 text-zinc-400"
                    strokeWidth={1.5}
                  />
                  <label htmlFor="q" className="sr-only">
                    {d.searchByName}
                  </label>
                  <input
                    id="q"
                    name="q"
                    defaultValue={filters.q ?? ""}
                    placeholder={d.searchPlaceholder}
                    className="w-full bg-transparent text-sm outline-none placeholder:text-zinc-400"
                  />
                </div>
                <div className="h-px w-full bg-black/[.08] dark:bg-white/[.145] sm:h-6 sm:w-px" />
                <div className="flex flex-1 items-center gap-2 px-4 py-2.5">
                  <MapPin
                    className="h-4 w-4 shrink-0 text-zinc-400"
                    strokeWidth={1.5}
                  />
                  <label htmlFor="city" className="sr-only">
                    {d.cityLabel}
                  </label>
                  <StyledSelect
                    id="city"
                    name="city"
                    defaultValue={filters.city ?? ""}
                  >
                    <option value="">{d.anyCity}</option>
                    {cities.map((city) => (
                      <option key={city} value={city}>
                        {city}
                      </option>
                    ))}
                  </StyledSelect>
                </div>
              </div>
              <Suspense fallback={null}>
                <NearMeButton label={d.nearMe} />
              </Suspense>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="minRating" className="text-sm font-medium">
                  {d.minRating}
                </label>
                <StyledSelect
                  id="minRating"
                  name="minRating"
                  defaultValue={filters.minRating ?? ""}
                >
                  <option value="">{d.any}</option>
                  <option value="4">{d.fourPlusStars}</option>
                  <option value="3">{d.threePlusStars}</option>
                </StyledSelect>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="sort" className="text-sm font-medium">
                  {d.sortBy}
                </label>
                <StyledSelect
                  id="sort"
                  name="sort"
                  defaultValue={effectiveSort}
                >
                  <option value="name">{d.sortName}</option>
                  <option value="rating">{d.sortRating}</option>
                  {hasOrigin && <option value="distance">{d.sortDistance}</option>}
                </StyledSelect>
              </div>
              {hasOrigin && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="radius" className="text-sm font-medium">
                    {d.within}
                  </label>
                  <StyledSelect
                    id="radius"
                    name="radius"
                    defaultValue={filters.radius ?? ""}
                  >
                    <option value="">{d.anyDistance}</option>
                    {RADIUS_OPTIONS_KM.map((km) => (
                      <option key={km} value={km}>
                        {km} km
                      </option>
                    ))}
                  </StyledSelect>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
            <CheckboxChip
              name="ev"
              value="1"
              label={d.evCapable}
              defaultChecked={filters.ev === "1"}
            />
            <CheckboxChip
              name="mobile"
              value="1"
              label={d.mobileService}
              defaultChecked={filters.mobile === "1"}
            />
            <CheckboxChip
              name="emergency"
              value="1"
              label={d.emergencyService}
              defaultChecked={filters.emergency === "1"}
            />
          </div>

          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {d.applyFilters}
            </button>
            <Link
              href={`/${lang}/garages`}
              className="text-sm font-medium underline"
            >
              {d.clear}
            </Link>
          </div>
        </form>

        <GarageDiscoveryMap
          garages={sorted
            .filter(
              (garage): garage is GarageWithDistance & { latitude: number; longitude: number } =>
                garage.latitude !== null && garage.longitude !== null
            )
            .map((garage) => ({
              id: garage.id,
              name: garage.name,
              latitude: garage.latitude,
              longitude: garage.longitude,
            }))}
          lang={lang}
        />

        <div className="flex flex-col gap-4">
          {sorted.length > 0 ? (
            sorted.map((garage) => (
              <Link
                key={garage.id}
                href={`/${lang}/garages/${garage.id}`}
                className="rounded-xl border border-black/[.08] bg-white p-6 transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-white/[.03]"
              >
                <h2 className="font-semibold text-black dark:text-zinc-50">
                  {garage.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {garage.city ? `${garage.city} · ` : ""}
                  {garage.services.length}{" "}
                  {garage.services.length === 1 ? d.service : d.services}
                  {garage.distanceKm !== null
                    ? ` · ${formatDistanceKm(garage.distanceKm)}`
                    : ""}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {formatRating(
                    garage.reviews.map((review) => review.rating),
                    d.noReviewsYet
                  )}
                </p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {d.noGaragesMatch}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
