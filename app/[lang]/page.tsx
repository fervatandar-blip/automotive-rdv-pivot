import Link from "next/link";
import { ArrowRight, ChevronDown, MapPin, Search } from "lucide-react";
import { BrandLogo, SpeedStripe } from "@/components/brand-mark";
import { LanguageSwitcher } from "@/components/language-switcher";
import { VerificationBadge } from "@/components/verification-badge";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { createClient } from "@/lib/supabase/server";
import { monogram } from "@/lib/monogram";
import {
  SERVICE_CATEGORIES,
  normalizeServiceCategory,
  type ServiceCategory,
} from "@/lib/service-categories";
import { normalizeVerificationLevel, type VerificationLevel } from "@/lib/verification";

// Light values are a cool studio grey and zinc; dark mode falls back to the
// app's semantic tokens so the page follows the theme like the rest.
const CONTAINER = "mx-auto w-full max-w-6xl px-4 sm:px-6";
const HEADING = "text-zinc-950 dark:text-ink";
const MUTED = "text-zinc-600 dark:text-ink-muted";
const RULE = "border-zinc-200 dark:border-hairline";

// The landing page's one accent: deep cobalt (brand-700, hover brand-800),
// on Sign up, Search and the speed-line stripes.
const BRAND_BUTTON =
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-brand-700 font-semibold text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-2";
const TEXT_LINK =
  "inline-flex items-center gap-1 font-semibold text-brand-700 transition-colors hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300";

// The hero's commune list leads with the main communes; any other city a
// listed workshop is in follows. "Luxembourg" (not "Luxembourg City") is
// sent because /garages matches part of the city name, so it finds the
// capital however a workshop spelled it.
const MAIN_CITIES: { value: string; label: (d: Dictionary) => string }[] = [
  { value: "Luxembourg", label: (d) => d.home.luxembourgCity },
  { value: "Esch-sur-Alzette", label: () => "Esch-sur-Alzette" },
  { value: "Differdange", label: () => "Differdange" },
  { value: "Dudelange", label: () => "Dudelange" },
];

// Popular searches open the results filtered. EV is a workshop capability
// (?ev=1), not a service category.
type PopularKey = keyof Dictionary["home"]["pills"];
const POPULAR_CATEGORIES = ["maintenance", "brakes", "tires", "diagnostics", "bodywork"] as const satisfies readonly ServiceCategory[];
const POPULAR: { key: PopularKey; query: string }[] = [
  ...POPULAR_CATEGORIES.map((key) => ({ key, query: `category=${key}` })),
  { key: "ev", query: "ev=1" },
];

const LISTED_COUNT = 6;
const MAX_ROW_CATEGORIES = 3;

// Seeded test workshops (scripts/seed-test-garage.ts names them "... (test)")
// stay bookable for QA on /garages but are never shown on the homepage.
function isTestWorkshop(name: string): boolean {
  return /\(test\)/i.test(name);
}

// Earned tiers first, so the strongest workshops lead.
const TIER_ORDER: Record<VerificationLevel, number> = {
  trusted_partner: 0,
  ev_certified: 1,
  verified: 2,
  basic: 3,
};

type ListedWorkshop = {
  id: string;
  name: string;
  city: string | null;
  verification_level: string | null;
  services: { id: string; name: string; category: string | null }[];
};

const HERO_CARD_COUNT = 3;

/** The hero card shows seeded test workshops too, without the "(test)" tag. */
function displayName(name: string): string {
  return name.replace(/\s*\(test\)/i, "");
}

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function categoriesOf(workshop: ListedWorkshop): ServiceCategory[] {
  const present = new Set(workshop.services.map((service) => normalizeServiceCategory(service.category)));
  return SERVICE_CATEGORIES.filter((category) => category !== "other" && present.has(category));
}

/** The main communes, then every other workshop city none of them already covers. */
function cityOptions(workshops: ListedWorkshop[], dictionary: Dictionary, lang: Locale) {
  const main = MAIN_CITIES.map((city) => ({ value: city.value, label: city.label(dictionary) }));
  const covered = main.map((city) => fold(city.value));
  const extra = [
    ...new Set(workshops.map((workshop) => workshop.city?.trim()).filter((city): city is string => !!city)),
  ]
    .filter((city) => !covered.some((value) => fold(city).includes(value)))
    .sort((a, b) => a.localeCompare(b, lang))
    .map((city) => ({ value: city, label: city }));
  return [...main, ...extra];
}

/** One line of the workshop directory. */
function WorkshopRow({
  workshop,
  lang,
  dictionary,
}: {
  workshop: ListedWorkshop;
  lang: Locale;
  dictionary: Dictionary;
}) {
  const categories = categoriesOf(workshop).slice(0, MAX_ROW_CATEGORIES);
  const level = normalizeVerificationLevel(workshop.verification_level);
  return (
    <li className="relative flex flex-col gap-4 px-5 py-5 transition-colors hover:bg-zinc-50 sm:flex-row sm:items-center sm:gap-6 sm:px-6 dark:hover:bg-subtle/60">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 font-display text-sm font-bold text-zinc-900 dark:border-hairline dark:bg-subtle dark:text-ink"
        >
          {monogram(workshop.name)}
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <h3 className={`truncate text-base font-bold ${HEADING}`}>
            {/* Stretched link: the whole row opens the workshop page. */}
            <Link href={`/${lang}/garages/${workshop.id}`} className="after:absolute after:inset-0">
              {workshop.name}
            </Link>
          </h3>
          <p className={`truncate text-sm ${MUTED}`}>
            {[workshop.city, ...categories.map((category) => dictionary.serviceCategories[category])]
              .filter(Boolean)
              .join(", ")}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        {level !== "basic" && <VerificationBadge level={level} labels={dictionary.verificationLevels} />}
        <Link
          href={`/${lang}/garages/${workshop.id}#book`}
          aria-label={dictionary.garageDiscovery.bookAt.replace("{name}", workshop.name)}
          className={`${TEXT_LINK} relative z-10 text-sm`}
        >
          {dictionary.home.book}
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      </div>
    </li>
  );
}

export default async function Home({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);
  const h = dictionary.home;
  const results = `/${lang}/garages`;

  // Public page: RLS shows anyone the approved workshops, nothing else.
  const supabase = await createClient();
  const { data } = await supabase
    .from("garages")
    .select("id, name, city, verification_level, services(id, name, category)")
    .eq("status", "approved")
    .is("deleted_at", null)
    .order("name", { ascending: true })
    .limit(200);
  const workshops = (data ?? []) as unknown as ListedWorkshop[];
  const listed = workshops
    .filter((workshop) => !isTestWorkshop(workshop.name))
    .sort(
      (a, b) =>
        TIER_ORDER[normalizeVerificationLevel(a.verification_level)] -
          TIER_ORDER[normalizeVerificationLevel(b.verification_level)] || a.name.localeCompare(b.name, lang)
    );
  const cities = cityOptions(workshops, dictionary, lang);
  const heroWorkshops = [...workshops]
    .sort(
      (a, b) =>
        TIER_ORDER[normalizeVerificationLevel(a.verification_level)] -
          TIER_ORDER[normalizeVerificationLevel(b.verification_level)] || a.name.localeCompare(b.name, lang)
    )
    .slice(0, HERO_CARD_COUNT);
  const card = h.heroCard;

  const points = [h.trust.verified, h.trust.calendar, h.trust.pay];

  return (
    <div className="flex flex-1 flex-col bg-[#F8F9FA] dark:bg-canvas">
      <header className={`${CONTAINER} flex h-16 items-center justify-between gap-4`}>
        <Link href={`/${lang}`} aria-label="RDV" className="rounded-lg">
          <BrandLogo size={34} />
        </Link>
        <nav aria-label={h.mainNav} className="flex items-center gap-1 sm:gap-2">
          <Link
            href={`/${lang}/demo`}
            className={`hidden rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:text-zinc-950 md:inline dark:hover:text-ink ${MUTED}`}
          >
            {h.forWorkshops}
          </Link>
          <span className="mx-1 hidden sm:inline-flex">
            <LanguageSwitcher lang={lang} />
          </span>
          <Link
            href={`/${lang}/login`}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors hover:bg-zinc-950/5 dark:hover:bg-subtle ${HEADING}`}
          >
            {dictionary.common.logIn}
          </Link>
          <Link href={`/${lang}/signup`} className={`${BRAND_BUTTON} px-4 py-2 text-sm`}>
            {h.signUp}
          </Link>
        </nav>
      </header>

      <main className="flex flex-col">
        {/* Hero. overflow-x-clip lets the livery stripe run to the viewport
            edge without a horizontal scrollbar. */}
        <section aria-labelledby="hero-title" className={`overflow-x-clip border-b ${RULE}`}>
          <div className={`${CONTAINER} grid gap-12 pb-16 pt-10 sm:pt-14 lg:grid-cols-12 lg:gap-10 lg:pb-20 lg:pt-16`}>
            <div className="flex min-w-0 flex-col lg:col-span-7 lg:pt-6">
              <h1
                id="hero-title"
                className={`max-w-[13ch] text-[2.6rem] font-semibold leading-[1.02] tracking-[-0.035em] sm:text-6xl lg:text-[4.25rem] ${HEADING}`}
              >
                {h.heroTitle}
              </h1>
              <p className={`mt-5 max-w-lg text-lg leading-relaxed ${MUTED}`}>{h.heroSubtitle}</p>

              {/* One compact horizontal bar (stacked on phones). Lands on the
                  workshop results with both filters applied. */}
              <form
                action={results}
                method="GET"
                role="search"
                aria-label={h.searchLabel}
                className="mt-9 flex max-w-xl flex-col items-stretch rounded-xl border border-zinc-200 bg-white p-1.5 shadow-sm sm:flex-row sm:items-center dark:border-hairline dark:bg-surface dark:shadow-none"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg px-3 py-2 transition-colors focus-within:bg-zinc-50 dark:focus-within:bg-subtle">
                  <Search aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={2} />
                  <label htmlFor="home-q" className="sr-only">
                    {h.serviceLabel}
                  </label>
                  <input
                    id="home-q"
                    name="q"
                    type="search"
                    autoComplete="off"
                    enterKeyHint="search"
                    placeholder={h.servicePlaceholder}
                    className="w-full min-w-0 bg-transparent text-[15px] text-zinc-950 outline-none placeholder:text-zinc-500 dark:text-ink dark:placeholder:text-ink-muted [&::-webkit-search-cancel-button]:hidden"
                  />
                </div>
                <span aria-hidden className="hidden h-7 w-px shrink-0 bg-zinc-200 sm:block dark:bg-hairline" />
                <div
                  className={`relative flex min-w-0 items-center gap-2.5 rounded-lg border-t px-3 py-2 transition-colors focus-within:bg-zinc-50 sm:w-48 sm:border-t-0 dark:focus-within:bg-subtle ${RULE}`}
                >
                  <MapPin aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={2} />
                  <label htmlFor="home-city" className="sr-only">
                    {h.cityLabel}
                  </label>
                  <select
                    id="home-city"
                    name="city"
                    defaultValue=""
                    className="w-full min-w-0 cursor-pointer appearance-none bg-transparent pr-5 text-[15px] text-zinc-950 outline-none dark:text-ink [&>option]:bg-white dark:[&>option]:bg-surface"
                  >
                    <option value="">{h.anyCity}</option>
                    {cities.map((city) => (
                      <option key={city.value} value={city.value}>
                        {city.label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown
                    aria-hidden
                    className="pointer-events-none absolute right-3 h-4 w-4 text-zinc-400"
                    strokeWidth={2}
                  />
                </div>
                <button
                  type="submit"
                  className="mt-1.5 inline-flex shrink-0 items-center justify-center rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 focus-visible:ring-offset-2 sm:mt-0 sm:ml-1.5"
                >
                  {h.searchSubmit}
                </button>
              </form>

              <nav aria-label={h.popularLabel} className="mt-4 flex flex-wrap items-center gap-2">
                <span className="mr-1 text-xs font-medium text-zinc-500 dark:text-ink-muted">{h.popularLabel}</span>
                <ul className="contents">
                  {POPULAR.map(({ key, query }) => (
                    <li key={key}>
                      <Link
                        href={`${results}?${query}`}
                        className="inline-flex rounded-full bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-700 no-underline transition-colors hover:bg-zinc-200/80 dark:bg-subtle dark:text-ink-muted dark:hover:bg-hairline dark:hover:text-ink"
                      >
                        {h.pills[key]}
                      </Link>
                    </li>
                  ))}
                </ul>
              </nav>
            </div>

            {/* Featured workshops card. */}
            <div className="min-w-0 lg:col-span-5 lg:pt-6">
              {heroWorkshops.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-hairline dark:bg-surface dark:shadow-none">
                  <div className="mb-4 flex items-center justify-between">
                    <h2 className={`text-base font-semibold ${HEADING}`}>{card.title}</h2>
                    <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-400">
                      {card.region}
                    </span>
                  </div>

                  <ul className="divide-y divide-zinc-100 dark:divide-hairline">
                    {heroWorkshops.map((workshop) => {
                      const name = displayName(workshop.name);
                      return (
                        <li
                          key={workshop.id}
                          className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0"
                        >
                          <div className="flex min-w-0 items-center gap-3">
                            <span
                              aria-hidden
                              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-sm font-semibold text-white dark:bg-ink dark:text-surface"
                            >
                              {monogram(name)}
                            </span>
                            <div className="min-w-0">
                              <p className={`truncate text-sm font-semibold ${HEADING}`}>{name}</p>
                              {workshop.city && (
                                <p className="truncate text-xs text-zinc-500 dark:text-ink-muted">{workshop.city}</p>
                              )}
                            </div>
                          </div>
                          <Link
                            href={`/${lang}/garages/${workshop.id}#book`}
                            aria-label={dictionary.garageDiscovery.bookAt.replace("{name}", name)}
                            className="shrink-0 rounded-lg bg-brand-700 px-3.5 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-800"
                          >
                            {card.book}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>

                  <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-hairline">
                    <Link
                      href={results}
                      className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      <span>{card.all}</span>
                      <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* Workshop directory: real approved workshops, earned tiers first.
            No ratings and no prices (both off for launch). */}
        {listed.length > 0 && (
          <section aria-labelledby="listed-title" className={`${CONTAINER} py-16`}>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-col gap-1">
                <h2 id="listed-title" className={`text-3xl font-bold ${HEADING}`}>
                  {h.featuredTitle}
                </h2>
                <p className={MUTED}>{h.featuredSubtitle}</p>
              </div>
              <Link href={results} className={`${TEXT_LINK} text-sm`}>
                {h.featuredAll}
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              </Link>
            </div>
            <ul
              className={`mt-8 divide-y overflow-hidden rounded-xl border bg-white dark:bg-surface ${RULE} divide-zinc-200 dark:divide-hairline`}
            >
              {listed.slice(0, LISTED_COUNT).map((workshop) => (
                <WorkshopRow key={workshop.id} workshop={workshop} lang={lang} dictionary={dictionary} />
              ))}
            </ul>
          </section>
        )}

        {/* What booking on RDV means, as three ruled columns. */}
        <section aria-labelledby="points-title" className={`${CONTAINER} py-16`}>
          <h2 id="points-title" className="sr-only">
            {h.trustTitle}
          </h2>
          <dl className="grid gap-10 md:grid-cols-3 md:gap-8">
            {points.map((point) => (
              <div key={point.title} className="flex flex-col gap-2 border-t-2 border-zinc-950 pt-5 dark:border-ink">
                <dt className={`font-display text-lg font-bold tracking-[-0.02em] ${HEADING}`}>{point.title}</dt>
                <dd className={`text-[15px] leading-relaxed ${MUTED}`}>{point.description}</dd>
              </div>
            ))}
          </dl>
        </section>

        {/* Workshop partner band: full bleed, with the stripe again. */}
        <section aria-labelledby="partner-title" className="relative overflow-hidden bg-zinc-950 text-white">
          <SpeedStripe className="absolute right-0 top-1/2 hidden w-[42%] -translate-y-1/2 text-brand-600 [--stripe-bar:2.5rem] lg:block" />
          <div className={`${CONTAINER} relative flex flex-col items-start gap-6 py-16 lg:py-20`}>
            <h2 id="partner-title" className="max-w-xl text-3xl font-bold sm:text-4xl">
              {h.partnerTitle}
            </h2>
            <p className="max-w-lg text-lg text-white/70">{h.partnerSubtitle}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-3">
              <Link
                href={`/${lang}/demo`}
                className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 text-sm font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
              >
                {h.partnerCta}
                <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
              </Link>
              <Link
                href={`/${lang}/garage/login`}
                className="text-sm font-semibold text-white/75 underline decoration-white/30 underline-offset-4 transition-colors hover:text-white hover:decoration-white"
              >
                {h.partnerLogin}
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className={`border-t ${RULE}`}>
        <div className={`${CONTAINER} flex flex-wrap items-center justify-between gap-4 py-6 text-sm ${MUTED}`}>
          <div className="flex items-center gap-3">
            <BrandLogo size={24} />
            <p>
              © {new Date().getFullYear()} RDV. {h.footer.rights}
            </p>
          </div>
          <div className="flex items-center gap-5">
            <Link href={`/${lang}/privacy`} className="transition-colors hover:text-zinc-950 dark:hover:text-ink">
              {h.footer.privacy}
            </Link>
            <LanguageSwitcher lang={lang} />
          </div>
        </div>
      </footer>
    </div>
  );
}
