import Link from "next/link";
import { getAuthedUser } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { averageRating, formatRating } from "@/lib/ratings";

function toArray(value: string | string[] | undefined): string[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

type GarageRow = {
  id: string;
  name: string;
  city: string | null;
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
  pricing?: string;
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
          "id, name, city, ev_capable, mobile_service, emergency_service, pricing_category, services(id), garage_brands(brand_id), garage_specialties(specialty_id), reviews(rating)"
        )
        .eq("status", "approved")
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
    if (filters.pricing && garage.pricing_category !== filters.pricing)
      return false;
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

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Browse garages
          </h1>
          <LanguageSwitcher lang={lang} />
        </div>

        <form
          method="GET"
          className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label htmlFor="q" className="text-sm font-medium">
                Search by name
              </label>
              <input
                id="q"
                name="q"
                defaultValue={filters.q ?? ""}
                placeholder="Garage name"
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="city" className="text-sm font-medium">
                City
              </label>
              <select
                id="city"
                name="city"
                defaultValue={filters.city ?? ""}
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              >
                <option value="">Any city</option>
                {cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="pricing" className="text-sm font-medium">
                Pricing
              </label>
              <select
                id="pricing"
                name="pricing"
                defaultValue={filters.pricing ?? ""}
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              >
                <option value="">Any</option>
                <option value="budget">Budget</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="minRating" className="text-sm font-medium">
                Minimum rating
              </label>
              <select
                id="minRating"
                name="minRating"
                defaultValue={filters.minRating ?? ""}
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              >
                <option value="">Any</option>
                <option value="4">4+ stars</option>
                <option value="3">3+ stars</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="sort" className="text-sm font-medium">
                Sort by
              </label>
              <select
                id="sort"
                name="sort"
                defaultValue={filters.sort ?? "name"}
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              >
                <option value="name">Name</option>
                <option value="rating">Rating</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="ev"
                value="1"
                defaultChecked={filters.ev === "1"}
              />
              EV capable
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="mobile"
                value="1"
                defaultChecked={filters.mobile === "1"}
              />
              Mobile service
            </label>
            <label className="flex items-center gap-1.5">
              <input
                type="checkbox"
                name="emergency"
                value="1"
                defaultChecked={filters.emergency === "1"}
              />
              Emergency service
            </label>
          </div>

          {brands && brands.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Brands</span>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {brands.map((brand) => (
                  <label key={brand.id} className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      name="brand"
                      value={brand.id}
                      defaultChecked={selectedBrandIds.includes(brand.id)}
                    />
                    {brand.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {specialties && specialties.length > 0 && (
            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium">Specialties</span>
              <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                {specialties.map((specialty) => (
                  <label
                    key={specialty.id}
                    className="flex items-center gap-1.5"
                  >
                    <input
                      type="checkbox"
                      name="specialty"
                      value={specialty.id}
                      defaultChecked={selectedSpecialtyIds.includes(
                        specialty.id
                      )}
                    />
                    {specialty.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-4">
            <button
              type="submit"
              className="rounded-full bg-foreground px-5 py-2 text-sm text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
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
