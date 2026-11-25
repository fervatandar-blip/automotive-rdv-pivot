import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Search, Star } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { GarageDiscoveryMap } from "@/components/garage-discovery-map";
import { StyledSelect } from "@/components/styled-select";
import { TogglePill } from "@/components/toggle-pill";
import { NearMeButton } from "@/components/near-me-button";
import { averageRating, formatRating } from "@/lib/ratings";
import { haversineDistanceKm, formatDistanceKm } from "@/lib/geo";
import { VerificationBadge } from "@/components/verification-badge";
import { parseBookingVehicle, withBookingVehicle } from "@/lib/booking-vehicle";
import { InstantFilterForm } from "@/components/instant-filter-form";
import { SERVICE_CATEGORIES, normalizeServiceCategory, type ServiceCategory } from "@/lib/service-categories";
import { CLIENT_CARD, CLIENT_PAGE, CLIENT_PAGE_TITLE } from "@/lib/client-ui";

// Toolbar controls: borderless, tinted on hover, one 36px height.
const TOOLBAR_SELECT =
  "h-9 cursor-pointer rounded-lg bg-transparent pl-3 pr-8 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 focus:bg-zinc-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:bg-transparent dark:text-zinc-200 dark:hover:bg-zinc-800/60 dark:focus:bg-zinc-800/60 [&>option]:bg-white [&>option]:text-zinc-900 dark:[&>option]:bg-zinc-900 dark:[&>option]:text-zinc-100";
const TOOLBAR_SELECT_WRAPPER = "flex-1 sm:flex-none";
const TOOLBAR_BUTTON =
  "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 disabled:opacity-60 dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50 [&>svg]:h-4 [&>svg]:w-4";
const TOOLBAR_DIVIDER = "hidden h-5 w-px shrink-0 bg-zinc-200 sm:block dark:bg-zinc-800";

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

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const { garageDiscovery } = await getDictionary(resolveLocale(lang));
  return { title: garageDiscovery.title };
}

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
    <div className={CLIENT_PAGE}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <h1 className={CLIENT_PAGE_TITLE}>{d.title}</h1>

        {bookingVehicleLabel && (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-brand-900 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-100">
            <span>{d.bookingFor.replace("{vehicle}", bookingVehicleLabel)}</span>
            <Link href={`/${lang}/garages`} className="font-medium underline underline-offset-2">
              {d.clearBookingVehicle}
            </Link>
          </p>
        )}

        {/* One toolbar: search, the selects, location, then the service
            toggles. Wraps onto extra rows on phones. */}
        <InstantFilterForm
          ariaLabel={d.filters}
          className={`${CLIENT_CARD} flex flex-wrap items-center gap-1 p-2`}
          resetLabel={d.clear}
          showReset={filtersActive}
          keepOnReset={["vehicle"]}
          resetClassName="h-9 shrink-0 rounded-lg px-3 text-sm font-medium text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 sm:ml-auto dark:text-zinc-400 dark:hover:bg-zinc-800/60 dark:hover:text-zinc-50"
        >
          {hasOrigin && (
            <>
              <input type="hidden" name="lat" value={filters.lat} />
              <input type="hidden" name="lng" value={filters.lng} />
            </>
          )}
          {vehicleId && <input type="hidden" name="vehicle" value={vehicleId} />}

          <div className="flex h-9 min-w-0 basis-full items-center gap-2 rounded-lg bg-zinc-100/70 px-3 transition-colors focus-within:bg-white focus-within:ring-2 focus-within:ring-brand-600/30 sm:min-w-[12rem] sm:flex-1 sm:basis-auto dark:bg-zinc-800/40 dark:focus-within:bg-zinc-900">
            <Search aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.75} />
            <label htmlFor="q" className="sr-only">
              {d.searchByName}
            </label>
            <input
              id="q"
              name="q"
              type="search"
              defaultValue={filters.q ?? ""}
              placeholder={d.searchPlaceholder}
              autoComplete="off"
              enterKeyHint="search"
              className="w-full min-w-0 bg-transparent text-sm text-zinc-900 outline-none placeholder:text-zinc-400 dark:text-zinc-50 [&::-webkit-search-cancel-button]:hidden"
            />
          </div>

          <label htmlFor="city" className="sr-only">
            {d.cityLabel}
          </label>
          <StyledSelect
            id="city"
            name="city"
            defaultValue={filters.city ?? ""}
            variant="bare"
            className={TOOLBAR_SELECT}
            wrapperClassName={TOOLBAR_SELECT_WRAPPER}
          >
            <option value="">{d.anyCity}</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </StyledSelect>

          <label htmlFor="minRating" className="sr-only">
            {d.minRating}
          </label>
          <StyledSelect
            id="minRating"
            name="minRating"
            defaultValue={filters.minRating ?? ""}
            variant="bare"
            className={TOOLBAR_SELECT}
            wrapperClassName={TOOLBAR_SELECT_WRAPPER}
          >
            <option value="">{d.any}</option>
            <option value="4">{d.fourPlusStars}</option>
            <option value="3">{d.threePlusStars}</option>
          </StyledSelect>

          <label htmlFor="sort" className="sr-only">
            {d.sortBy}
          </label>
          <StyledSelect
            id="sort"
            name="sort"
            defaultValue={effectiveSort}
            variant="bare"
            className={TOOLBAR_SELECT}
            wrapperClassName={TOOLBAR_SELECT_WRAPPER}
          >
            <option value="name">{d.sortByName}</option>
            <option value="rating">{d.sortByRating}</option>
            {hasOrigin && <option value="distance">{d.sortByDistance}</option>}
          </StyledSelect>

          {hasOrigin ? (
            <>
              <label htmlFor="radius" className="sr-only">
                {d.within}
              </label>
              <StyledSelect
                id="radius"
                name="radius"
                defaultValue={filters.radius ?? ""}
                variant="bare"
                className={TOOLBAR_SELECT}
                wrapperClassName={TOOLBAR_SELECT_WRAPPER}
              >
                <option value="">{d.anyDistance}</option>
                {RADIUS_OPTIONS_KM.map((km) => (
                  <option key={km} value={km}>
                    {km} km
                  </option>
                ))}
              </StyledSelect>
            </>
          ) : (
            <Suspense fallback={null}>
              <NearMeButton label={d.nearMe} className={TOOLBAR_BUTTON} />
            </Suspense>
          )}

          <span aria-hidden className={TOOLBAR_DIVIDER} />

          <TogglePill name="ev" label={d.evShort} title={d.evCapable} defaultChecked={filters.ev === "1"} />
          <TogglePill
            name="mobile"
            label={d.mobileShort}
            title={d.mobileService}
            defaultChecked={filters.mobile === "1"}
          />
          <TogglePill
            name="emergency"
            label={d.emergencyShort}
            title={d.emergencyService}
            defaultChecked={filters.emergency === "1"}
          />
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
                  className={`${CLIENT_CARD} relative flex items-center gap-4 p-4 transition-colors focus-within:border-brand-600 hover:border-zinc-300 sm:p-5 dark:hover:border-zinc-700`}
                >
                  <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <h2 className="font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
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
                    <p className="flex flex-wrap items-center gap-x-1.5 text-sm text-zinc-500 dark:text-zinc-400">
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
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{d.noGaragesMatch}</p>
        )}
      </div>
    </div>
  );
}
