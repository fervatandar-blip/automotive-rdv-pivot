import Link from "next/link";
import { Search, MapPin, Check } from "lucide-react";
import { getAuthedUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { GarageDiscoveryMap } from "@/components/garage-discovery-map";
import { BrandLogoBadge } from "@/components/brand-logo-badge";
import { StyledSelect } from "@/components/styled-select";
import { averageRating, formatRating } from "@/lib/ratings";

function FilterCheckbox({
  id,
  name,
  value,
  label,
  defaultChecked,
}: {
  id?: string;
  name: string;
  value: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <input
        id={id}
        type="checkbox"
        name={name}
        value={value}
        defaultChecked={defaultChecked}
        className="peer sr-only"
      />
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-black/[.08] transition-colors peer-checked:border-brand-600 peer-checked:bg-brand-600 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-600/40 peer-focus-visible:ring-offset-2 dark:border-white/[.145] [&>svg]:opacity-0 [&>svg]:transition-opacity peer-checked:[&>svg]:opacity-100">
        <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />
      </span>
      {label}
    </label>
  );
}

const CURATED_BRANDS: { name: string; slug: string }[] = [
  { name: "Volkswagen", slug: "volkswagen" },
  { name: "Audi", slug: "audi" },
  { name: "BMW", slug: "bmw" },
  { name: "Tesla", slug: "tesla" },
  { name: "Renault", slug: "renault" },
];

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

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
  garage_brands: { brand_id: string }[];
  garage_specialties: { specialty_id: string }[];
  reviews: { rating: number }[];
};

type SearchParams = {
  q?: string;
  city?: string;
  brand?: string | string[];
  specialty?: string | string[];
  ev?: string;
  mobile?: string;
  emergency?: string;
  minRating?: string;
  sort?: string;
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
  await getAuthedUser(lang);
  const filters = await searchParams;

  const supabase = await createClient();

  const [{ data: garages }, { data: brands }, { data: specialties }] =
    await Promise.all([
      supabase
        .from("garages")
        .select(
          "id, name, city, latitude, longitude, ev_capable, mobile_service, emergency_service, pricing_category, services(id), garage_brands(brand_id), garage_specialties(specialty_id), reviews(rating)"
        )
        .eq("status", "approved")
        .is("deleted_at", null)
        .order("name", { ascending: true }),
      supabase.from("brands").select("id, name").order("name"),
      supabase.from("specialties").select("id, name").order("name"),
    ]);

  const rows = (garages ?? []) as unknown as GarageRow[];
  const cities = Array.from(
    new Set(rows.map((garage) => garage.city).filter((city): city is string => !!city))
  ).sort();

  const selectedBrandIds = toArray(filters.brand);
  const selectedSpecialtyIds = toArray(filters.specialty);
  const minRating = filters.minRating ? Number(filters.minRating) : 0;
  const query = filters.q?.trim().toLowerCase() ?? "";

  const filtered = rows.filter((garage) => {
    if (query && !garage.name.toLowerCase().includes(query)) return false;
    if (filters.city && garage.city !== filters.city) return false;
    if (filters.ev === "1" && !garage.ev_capable) return false;
    if (filters.mobile === "1" && !garage.mobile_service) return false;
    if (filters.emergency === "1" && !garage.emergency_service) return false;
    if (
      selectedBrandIds.length > 0 &&
      !garage.garage_brands.some((link) =>
        selectedBrandIds.includes(link.brand_id)
      )
    )
      return false;
    if (
      selectedSpecialtyIds.length > 0 &&
      !garage.garage_specialties.some((link) =>
        selectedSpecialtyIds.includes(link.specialty_id)
      )
    )
      return false;
    if (minRating > 0) {
      const average = averageRating(garage.reviews.map((review) => review.rating));
      if (average === null || average < minRating) return false;
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (filters.sort === "rating") {
      const ratingA = averageRating(a.reviews.map((review) => review.rating)) ?? -1;
      const ratingB = averageRating(b.reviews.map((review) => review.rating)) ?? -1;
      return ratingB - ratingA;
    }
    return a.name.localeCompare(b.name);
  });

  const curatedBrands = CURATED_BRANDS.map((curated) => {
    const brand = (brands ?? []).find(
      (row) => row.name.toLowerCase() === curated.name.toLowerCase()
    );
    return brand ? { ...brand, slug: curated.slug } : null;
  }).filter(
    (brand): brand is { id: string; name: string; slug: string } =>
      Boolean(brand)
  );

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Find a Trusted Garage
        </h1>

        <form
          method="GET"
          className="flex flex-col gap-8 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col overflow-hidden rounded-full border border-black/[.08] dark:border-white/[.145] sm:flex-row sm:items-center">
              <div className="flex flex-1 items-center gap-2 px-4 py-2.5">
                <Search
                  className="h-4 w-4 shrink-0 text-zinc-400"
                  strokeWidth={1.5}
                />
                <label htmlFor="q" className="sr-only">
                  Search by name
                </label>
                <input
                  id="q"
                  name="q"
                  defaultValue={filters.q ?? ""}
                  placeholder="Search by garage name"
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
                  City
                </label>
                <StyledSelect
                  id="city"
                  name="city"
                  defaultValue={filters.city ?? ""}
                >
                  <option value="">Any city</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>
                      {city}
                    </option>
                  ))}
                </StyledSelect>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="minRating" className="text-sm font-medium">
                  Minimum rating
                </label>
                <StyledSelect
                  id="minRating"
                  name="minRating"
                  defaultValue={filters.minRating ?? ""}
                >
                  <option value="">Any</option>
                  <option value="4">4+ stars</option>
                  <option value="3">3+ stars</option>
                </StyledSelect>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="sort" className="text-sm font-medium">
                  Sort by
                </label>
                <StyledSelect
                  id="sort"
                  name="sort"
                  defaultValue={filters.sort ?? "name"}
                >
                  <option value="name">Name</option>
                  <option value="rating">Rating</option>
                </StyledSelect>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
            <FilterCheckbox
              name="ev"
              value="1"
              label="EV capable"
              defaultChecked={filters.ev === "1"}
            />
            <FilterCheckbox
              name="mobile"
              value="1"
              label="Mobile service"
              defaultChecked={filters.mobile === "1"}
            />
            <FilterCheckbox
              name="emergency"
              value="1"
              label="Emergency service"
              defaultChecked={filters.emergency === "1"}
            />
          </div>

          {brands && brands.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
              {curatedBrands.length > 0 ? (
                <span className="text-sm font-medium">Popular brands</span>
              ) : (
                <span className="text-sm font-medium">Brands</span>
              )}

              {curatedBrands.length > 0 && (
                <div className="flex flex-wrap gap-3">
                  {curatedBrands.map((brand) => (
                    <BrandLogoBadge
                      key={brand.id}
                      htmlFor={`brand-${brand.id}`}
                      slug={brand.slug}
                      name={brand.name}
                      selected={selectedBrandIds.includes(brand.id)}
                    />
                  ))}
                </div>
              )}

              <details className="text-sm">
                <summary className="cursor-pointer select-none font-medium text-zinc-600 dark:text-zinc-400">
                  More brands
                </summary>
                <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {brands.map((brand) => (
                    <FilterCheckbox
                      key={brand.id}
                      id={`brand-${brand.id}`}
                      name="brand"
                      value={brand.id}
                      label={brand.name}
                      defaultChecked={selectedBrandIds.includes(brand.id)}
                    />
                  ))}
                </div>
              </details>
            </div>
          )}

          {specialties && specialties.length > 0 && (
            <div className="flex flex-col gap-3 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
              <span className="text-sm font-medium">Specialties</span>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {specialties.map((specialty) => (
                  <FilterCheckbox
                    key={specialty.id}
                    name="specialty"
                    value={specialty.id}
                    label={specialty.name}
                    defaultChecked={selectedSpecialtyIds.includes(
                      specialty.id
                    )}
                  />
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              Apply filters
            </button>
            <Link
              href={`/${lang}/garages`}
              className="text-sm font-medium underline"
            >
              Clear
            </Link>
          </div>
        </form>

        <GarageDiscoveryMap
          garages={sorted
            .filter(
              (garage): garage is GarageRow & { latitude: number; longitude: number } =>
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
                  {garage.services.length === 1 ? "service" : "services"}
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {formatRating(garage.reviews.map((review) => review.rating))}
                </p>
              </Link>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              No garages match those filters.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
