import Link from "next/link";
import { Suspense } from "react";
import { Search, MapPin, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { GarageDiscoveryMap } from "@/components/garage-discovery-map";
import { StyledSelect } from "@/components/styled-select";
import { CheckboxChip } from "@/components/checkbox-chip";
import { NearMeButton } from "@/components/near-me-button";
import { averageRating, formatRating } from "@/lib/ratings";
import { haversineDistanceKm, formatDistanceKm } from "@/lib/geo";
import { VerificationBadge } from "@/components/verification-badge";
import { parseBookingVehicle, withBookingVehicle } from "@/lib/booking-vehicle";
import { InstantFilterForm } from "@/components/instant-filter-form";
import { SERVICE_CATEGORIES, normalizeServiceCategory, type ServiceCategory } from "@/lib/service-categories";

const MAX_CATEGORY_TAGS = 3;

/** A workshop's service categories in display order, "other" left out. */
function categoriesOf(services: { category: string | null }[]): ServiceCategory[] {
  const present = new Set(services.map((service) => normalizeServiceCategory(service.category)));
  return SERVICE_CATEGORIES.filter((category) => category !== "other" && present.has(category));
}

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
  verification_level: string | null;
  services: { id: string; category: string | null }[];
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
  vehicle?: string;
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
  const bookingVehicleId = parseBookingVehicle(filters.vehicle);

  const supabase = await createClient();

  // No brand or specialty filters: garages don't maintain that data after
  // onboarding, so the filters would go stale.
  const { data: garages } = await supabase
    .from("garages")
    .select(
      "id, name, city, latitude, longitude, ev_capable, mobile_service, emergency_service, pricing_category, verification_level, services(id, category), reviews(rating)"
    )
    .eq("status", "approved")
    .is("deleted_at", null)
    .order("name", { ascending: true });

  const rows = (garages ?? []) as unknown as GarageRow[];

  // From a vehicle card's "Book Service": name the car being booked for.
  // RLS returns nothing for someone else's vehicle (or a signed-out visitor),
  // in which case the param is dropped.
  const { data: bookingVehicle } = bookingVehicleId
    ? await supabase
        .from("vehicles")
        .select("id, model, license_plate, brands(name)")
        .eq("id", bookingVehicleId)
        .maybeSingle()
    : { data: null };
  const vehicleId = bookingVehicle ? bookingVehicleId : null;
  const bookingVehicleLabel = bookingVehicle
    ? [
        [(bookingVehicle.brands as unknown as { name: string } | null)?.name, bookingVehicle.model]
          .filter(Boolean)
          .join(" "),
        bookingVehicle.license_plate,
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
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
  const filtersActive = Boolean(
    query ||
      filters.city ||
      filters.ev === "1" ||
      filters.mobile === "1" ||
      filters.emergency === "1" ||
      minRating > 0 ||
      filters.sort ||
      hasOrigin ||
      filters.radius
  );

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
    <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-3xl">
          {d.title}
        </h1>

        {bookingVehicleLabel && (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-100">
            <span>{d.bookingFor.replace("{vehicle}", bookingVehicleLabel)}</span>
            <Link href={`/${lang}/garages`} className="font-medium underline underline-offset-2">
              {d.clearBookingVehicle}
            </Link>
          </p>
        )}

        <InstantFilterForm
          className="flex flex-col gap-5 rounded-xl border border-zinc-200/80 bg-white p-5 sm:p-6 dark:border-zinc-800/60 dark:bg-zinc-950/40"
          resetLabel={d.clear}
          showReset={filtersActive}
          keepOnReset={["vehicle"]}
        >
          <div className="flex flex-col gap-4">
            {hasOrigin && (
              <>
                <input type="hidden" name="lat" value={filters.lat} />
                <input type="hidden" name="lng" value={filters.lng} />
              </>
            )}
            {vehicleId && <input type="hidden" name="vehicle" value={vehicleId} />}

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

          <div className="flex flex-wrap gap-x-5 gap-y-3 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/60">
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

        </InstantFilterForm>

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
          vehicleId={vehicleId}
        />

        {sorted.length > 0 ? (
          <ul className="flex flex-col gap-3">
            {sorted.map((garage) => {
              const href = withBookingVehicle(`/${lang}/garages/${garage.id}`, vehicleId);
              const ratings = garage.reviews.map((review) => review.rating);
              const categories = categoriesOf(garage.services);
              const extraCategories = categories.length - MAX_CATEGORY_TAGS;
              // "Basic" is every workshop's starting tier: only earned tiers
              // get a badge on the card.
              const showBadge = garage.verification_level && garage.verification_level !== "basic";
              return (
                <li
                  key={garage.id}
                  className="relative flex items-center gap-4 rounded-xl border border-zinc-200/80 bg-white p-4 transition-colors focus-within:border-brand-600 hover:border-zinc-300 sm:p-5 dark:border-zinc-800/60 dark:bg-zinc-950/40 dark:hover:border-zinc-700"
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <h2 className="font-semibold text-black dark:text-zinc-50">
                        {/* Stretched link: the whole card opens the profile;
                            Book stays its own target above it. */}
                        <Link href={href} className="after:absolute after:inset-0 after:rounded-xl focus:outline-none">
                          {garage.name}
                        </Link>
                      </h2>
                      {showBadge && (
                        <VerificationBadge level={garage.verification_level} labels={dictionary.verificationLevels} />
                      )}
                    </div>
                    <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-zinc-600 dark:text-zinc-400">
                      {garage.city && <span>{garage.city}</span>}
                      {garage.distanceKm !== null && <span>· {formatDistanceKm(garage.distanceKm)}</span>}
                      {(garage.city || garage.distanceKm !== null) && <span aria-hidden>·</span>}
                      <span className="inline-flex items-center gap-1">
                        {ratings.length > 0 && (
                          <Star aria-hidden className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        )}
                        {formatRating(ratings, d.noReviewsYet)}
                      </span>
                    </p>
                    {categories.length > 0 && (
                      <ul className="mt-1 flex flex-wrap gap-1.5">
                        {categories.slice(0, MAX_CATEGORY_TAGS).map((category) => (
                          <li
                            key={category}
                            className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300"
                          >
                            {dictionary.serviceCategories[category]}
                          </li>
                        ))}
                        {extraCategories > 0 && (
                          <li className="px-1 py-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {d.moreCategories.replace("{count}", String(extraCategories))}
                          </li>
                        )}
                      </ul>
                    )}
                  </div>
                  <Link
                    href={withBookingVehicle(`/${lang}/garages/${garage.id}#book`, vehicleId)}
                    aria-label={d.bookAt.replace("{name}", garage.name)}
                    className="relative z-10 inline-flex h-9 shrink-0 items-center rounded-full bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-2 dark:bg-brand-500 dark:hover:bg-brand-600 dark:focus-visible:ring-offset-black"
                  >
                    {d.book}
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.noGaragesMatch}</p>
        )}
      </div>
    </div>
  );
}
