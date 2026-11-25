import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, List, Map as MapIcon, MapPin, Search } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { GarageDiscoveryMap } from "@/components/garage-discovery-map";
import { StyledSelect } from "@/components/styled-select";
import { TogglePill } from "@/components/toggle-pill";
import { NearMeButton } from "@/components/near-me-button";
import { averageRating } from "@/lib/ratings";
import { RatingPill } from "@/components/star-rating";
import { CapabilityPill, capabilityList } from "@/components/capability-pills";
import { REVIEWS_ENABLED } from "@/lib/features";
import { monogram } from "@/lib/monogram";
import { directionsUrl } from "@/lib/maps";
import { haversineDistanceKm, formatDistanceKm } from "@/lib/geo";
import { VerificationBadge } from "@/components/verification-badge";
import { parseBookingVehicle, withBookingVehicle } from "@/lib/booking-vehicle";
import { InstantFilterForm } from "@/components/instant-filter-form";
import { SERVICE_CATEGORIES, normalizeServiceCategory, type ServiceCategory } from "@/lib/service-categories";
import {
  CLIENT_CARD,
  CLIENT_FIT_PAGE,
  CLIENT_PAGE_SUBTITLE,
  CLIENT_PAGE_TITLE,
  CLIENT_PRIMARY_BUTTON,
  CLIENT_SEGMENT,
  CLIENT_SEGMENTED,
  CLIENT_SEGMENT_ACTIVE,
  CLIENT_SEGMENT_IDLE,
  CLIENT_TAG,
} from "@/lib/client-ui";

// Toolbar controls: borderless, tinted on hover, one 36px height.
const TOOLBAR_SELECT =
  "h-10 cursor-pointer rounded-xl bg-transparent pl-3.5 pr-9 text-sm font-semibold text-ink transition-colors hover:bg-subtle focus:bg-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 [&>option]:bg-surface [&>option]:text-ink";
const TOOLBAR_SELECT_WRAPPER = "flex-1 sm:flex-none";
const TOOLBAR_BUTTON =
  "inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 disabled:opacity-60 [&>svg]:h-4 [&>svg]:w-4";
const TOOLBAR_DIVIDER = "mx-1 hidden h-6 w-px shrink-0 bg-hairline sm:block";

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
  // Only selected while REVIEWS_ENABLED.
  reviews?: { rating: number }[];
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
  view?: string;
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
      `id, name, city, latitude, longitude, ev_capable, mobile_service, emergency_service, pricing_category, verification_level, services(id, category)${
        REVIEWS_ENABLED ? ", reviews(rating)" : ""
      }`
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
        .join(", ")
    : null;
  const cities = Array.from(
    new Set(rows.map((garage) => garage.city).filter((city): city is string => !!city))
  ).sort();

  // Ratings are ignored entirely while reviews are off (old ?minRating= and
  // ?sort=rating links just fall back to the defaults).
  const minRating = REVIEWS_ENABLED && filters.minRating ? Number(filters.minRating) : 0;
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
      const average = averageRating((garage.reviews ?? []).map((review) => review.rating));
      if (average === null || average < minRating) return false;
    }
    if (hasOrigin && radiusKm !== null) {
      if (garage.distanceKm === null || garage.distanceKm > radiusKm) return false;
    }
    return true;
  });

  const requestedSort =
    filters.sort === "rating" && !REVIEWS_ENABLED ? undefined : filters.sort === "distance" && !hasOrigin ? undefined : filters.sort;
  const effectiveSort = requestedSort ?? (hasOrigin ? "distance" : "name");
  const filtersActive = Boolean(
    query ||
      filters.city ||
      filters.ev === "1" ||
      filters.mobile === "1" ||
      filters.emergency === "1" ||
      minRating > 0 ||
      requestedSort ||
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
      const ratingA = averageRating((a.reviews ?? []).map((review) => review.rating)) ?? -1;
      const ratingB = averageRating((b.reviews ?? []).map((review) => review.rating)) ?? -1;
      return ratingB - ratingA;
    }
    return a.name.localeCompare(b.name);
  });

  const mapGarages = sorted
    .filter(
      (garage): garage is GarageWithDistance & { latitude: number; longitude: number } =>
        garage.latitude !== null && garage.longitude !== null
    )
    .map((garage) => ({
      id: garage.id,
      name: garage.name,
      city: garage.city,
      latitude: garage.latitude,
      longitude: garage.longitude,
      distance: garage.distanceKm !== null ? formatDistanceKm(garage.distanceKm) : null,
    }));
  // Same conditions under which GarageDiscoveryMap renders anything.
  const showMap = Boolean(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) && mapGarages.length > 0;
  // List (with the map beside it from lg) or a full map. The toggle only
  // exists when there's a map to show.
  const isMapView = showMap && filters.view === "map";
  const viewHref = (view: "list" | "map") => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (key !== "view" && typeof value === "string" && value) params.set(key, value);
    }
    if (view === "map") params.set("view", "map");
    const query = params.toString();
    return `/${lang}/garages${query ? `?${query}` : ""}`;
  };
  const mapLabels = {
    map: d.mapLabel,
    book: d.bookAppointmentCta,
    directions: dictionary.clientDashboard.directions,
    close: d.closePreview,
  };

  return (
    <div className={CLIENT_FIT_PAGE}>
      <div className="mx-auto flex min-h-0 w-full max-w-6xl flex-1 flex-col gap-4">
        <header className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
          <h1 className={CLIENT_PAGE_TITLE}>{d.title}</h1>
          <p className={`${CLIENT_PAGE_SUBTITLE} tabular-nums`}>
            {d.resultCount.replace("{count}", String(sorted.length))}
          </p>
        </header>

        {bookingVehicleLabel && (
          <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-sm font-medium text-brand-900 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-100">
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
          className="flex shrink-0 flex-wrap items-center gap-1.5 rounded-2xl border border-zinc-200/80 bg-surface p-3 shadow-sm dark:border-hairline dark:shadow-none"
          resetLabel={d.clear}
          showReset={filtersActive}
          keepOnReset={["vehicle", "view"]}
          resetClassName="h-10 shrink-0 rounded-xl px-3.5 text-sm font-semibold text-ink-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 sm:ml-auto"
        >
          {isMapView && <input type="hidden" name="view" value="map" />}
          {hasOrigin && (
            <>
              <input type="hidden" name="lat" value={filters.lat} />
              <input type="hidden" name="lng" value={filters.lng} />
            </>
          )}
          {vehicleId && <input type="hidden" name="vehicle" value={vehicleId} />}

          <div className="flex h-11 min-w-0 basis-full items-center gap-2.5 rounded-xl bg-subtle px-4 transition-colors focus-within:bg-surface focus-within:ring-2 focus-within:ring-ink/15 sm:min-w-[14rem] sm:flex-1 sm:basis-auto">
            <Search aria-hidden className="h-[18px] w-[18px] shrink-0 text-ink-muted" strokeWidth={2} />
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
              className="w-full min-w-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
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

          {REVIEWS_ENABLED && (
            <>
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
            </>
          )}

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
            {REVIEWS_ENABLED && <option value="rating">{d.sortByRating}</option>}
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

          {showMap && (
            <nav aria-label={d.viewToggle} className={`${CLIENT_SEGMENTED} shrink-0 shadow-none sm:ml-auto`}>
              {(["list", "map"] as const).map((option) => {
                const active = (option === "map") === isMapView;
                const Icon = option === "map" ? MapIcon : List;
                return (
                  <Link
                    key={option}
                    href={viewHref(option)}
                    scroll={false}
                    aria-current={active ? "page" : undefined}
                    className={`${CLIENT_SEGMENT} px-3 ${active ? CLIENT_SEGMENT_ACTIVE : CLIENT_SEGMENT_IDLE}`}
                  >
                    <Icon aria-hidden className="h-4 w-4" strokeWidth={2} />
                    {option === "map" ? d.viewMap : d.viewList}
                  </Link>
                );
              })}
            </nav>
          )}
        </InstantFilterForm>

        {/* List view: the cards, with the map beside them from lg (phones use
            the toggle). Map view: the map alone, full size. */}
        <div
          className={`grid min-h-0 flex-1 grid-cols-1 gap-4 ${
            showMap && !isMapView ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]" : ""
          }`}
        >
          {/* Cards scroll in this column; the side padding keeps their
              shadow from being clipped by the scroll box. */}
          <section
            aria-label={d.title}
            className={`-mx-2 min-h-0 flex-col overflow-y-auto px-2 pb-2 ${isMapView ? "hidden" : "flex"}`}
          >
            {sorted.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {sorted.map((garage) => {
                  const href = withBookingVehicle(`/${lang}/garages/${garage.id}`, vehicleId);
                  const ratings = (garage.reviews ?? []).map((review) => review.rating);
                  const capabilities = capabilityList(garage, dictionary.garageOnboarding);
                  const average = averageRating(ratings);
                  const categories = categoriesOf(garage.services);
                  const extraCategories = categories.length - MAX_CATEGORY_TAGS;
                  // "Basic" is every workshop's starting tier: only earned tiers
                  // get a badge on the card.
                  const showBadge = garage.verification_level && garage.verification_level !== "basic";
                  return (
                    <li
                      key={garage.id}
                      className={`${CLIENT_CARD} relative flex flex-col gap-4 p-5 transition-shadow focus-within:ring-2 focus-within:ring-ink/20 hover:shadow-[0_4px_16px_rgba(0,0,0,0.07)] sm:flex-row sm:items-center sm:p-6`}
                    >
                      <div className="flex min-w-0 flex-1 items-start gap-4">
                        <span
                          aria-hidden
                          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-ink font-display text-lg font-bold tracking-[-0.02em] text-surface"
                        >
                          {monogram(garage.name)}
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-2">
                          <h2 className="text-lg font-bold tracking-tight text-ink">
                            {/* Stretched link: the whole card opens the profile;
                                the booking button stays its own target above it. */}
                            <Link href={href} className="after:absolute after:inset-0 after:rounded-2xl focus:outline-none">
                              {garage.name}
                            </Link>
                          </h2>
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-muted">
                            {garage.city && (
                              // Above the card's stretched link: opens directions,
                              // not the workshop page.
                              <a
                                href={directionsUrl(garage) ?? undefined}
                                target="_blank"
                                rel="noopener noreferrer"
                                aria-label={dictionary.clientDashboard.directionsTo.replace("{name}", garage.name)}
                                className="relative z-10 inline-flex items-center gap-1 rounded-md underline decoration-hairline underline-offset-4 transition-colors hover:text-ink hover:decoration-current"
                              >
                                <MapPin aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                                {garage.city}
                                {garage.distanceKm !== null && (
                                  <span className="tabular-nums">({formatDistanceKm(garage.distanceKm)})</span>
                                )}
                              </a>
                            )}
                            {REVIEWS_ENABLED &&
                              (average !== null ? (
                                <RatingPill
                                  average={average}
                                  count={ratings.length}
                                  label={dictionary.common.ratingSummary
                                    .replace("{rating}", average.toFixed(1))
                                    .replace("{count}", String(ratings.length))}
                                />
                              ) : (
                                <span>{d.noReviewsYet}</span>
                              ))}
                            {showBadge && (
                              <VerificationBadge level={garage.verification_level} labels={dictionary.verificationLevels} />
                            )}
                            {capabilities.map(({ key, icon, label }) => (
                              <CapabilityPill key={key} icon={icon} label={label} />
                            ))}
                          </div>
                          {categories.length > 0 && (
                            <ul className="flex flex-wrap gap-1.5 pt-1">
                              {categories.slice(0, MAX_CATEGORY_TAGS).map((category) => (
                                <li key={category} className={CLIENT_TAG}>
                                  {dictionary.serviceCategories[category]}
                                </li>
                              ))}
                              {extraCategories > 0 && (
                                <li className="inline-flex items-center px-1 text-xs font-medium text-ink-muted">
                                  {d.moreCategories.replace("{count}", String(extraCategories))}
                                </li>
                              )}
                            </ul>
                          )}
                        </div>
                      </div>
                      <Link
                        href={withBookingVehicle(`/${lang}/garages/${garage.id}#book`, vehicleId)}
                        aria-label={d.bookAt.replace("{name}", garage.name)}
                        className={`${CLIENT_PRIMARY_BUTTON} relative z-10 w-full sm:w-auto`}
                      >
                        {d.bookAppointmentCta}
                        <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className={`${CLIENT_CARD} px-6 py-12 text-center text-sm text-ink-muted`}>{d.noGaragesMatch}</p>
            )}
          </section>

          {showMap && (
            <GarageDiscoveryMap
              className={`overflow-hidden ${CLIENT_CARD} ${
                isMapView ? "h-[70dvh] md:h-full md:min-h-[28rem]" : "hidden lg:block lg:h-full lg:min-h-0"
              }`}
              garages={mapGarages}
              lang={lang}
              vehicleId={vehicleId}
              labels={mapLabels}
            />
          )}
        </div>
      </div>
    </div>
  );
}
