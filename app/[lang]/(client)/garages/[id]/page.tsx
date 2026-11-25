import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Banknote,
  BellPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock,
  Globe,
  Mail,
  MapPin,
  Phone,
} from "lucide-react";
import { getOptionalAuthedUser } from "@/lib/dal";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/supabase/server";
import { getAvailableSlotsForDate } from "@/lib/availability";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { closedDateKeys } from "@/lib/closed-days";
import { groupServicesByCategory } from "@/lib/service-categories";
import { normalizeVerificationLevel } from "@/lib/verification";
import { VerificationBadge } from "@/components/verification-badge";
import { CapabilityPill, capabilityList } from "@/components/capability-pills";
import { parseBookingVehicle, withBookingVehicle } from "@/lib/booking-vehicle";
import { GarageMapDisplay } from "@/components/garage-map-display";
import { bookAppointment } from "@/app/actions/appointments";
import { joinWaitlist } from "@/app/actions/waitlist";
import { hasAnyOpeningHours, summarizeWeeklyHours } from "@/lib/opening-hours";
import { APP_TIME_ZONE, dateKeyToDisplayDate, todayKeyInAppZone } from "@/lib/timezone";
import { monogram } from "@/lib/monogram";
import { REVIEWS_ENABLED } from "@/lib/features";
import { averageRating } from "@/lib/ratings";
import { RatingPill, StarRating } from "@/components/star-rating";
import {
  CLIENT_CARD,
  CLIENT_PAGE,
  CLIENT_PRIMARY_BUTTON,
  CLIENT_SECONDARY_BUTTON,
  CLIENT_SECTION_LABEL,
  CLIENT_TEXT_LINK,
} from "@/lib/client-ui";

const FIELD =
  "w-full rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-sm text-ink focus:border-ink/40 focus:outline-none focus:ring-2 focus:ring-ink/10";
const CARD_HEADING = "text-sm font-bold tracking-tight text-ink";
const MONTH_NAV =
  "flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-subtle hover:text-ink";

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function monthKey(year: number, monthIndex: number) {
  return `${year}-${(monthIndex + 1).toString().padStart(2, "0")}`;
}

function parseMonthKey(month: string | undefined, fallback: { year: number; monthIndex: number }) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, m] = month.split("-").map(Number);
    return { year, monthIndex: m - 1 };
  }
  return fallback;
}

function buildCalendarGrid(year: number, monthIndex: number) {
  const startWeekday = new Date(year, monthIndex, 1).getDay();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: { date: Date; inMonth: boolean }[] = [];

  for (let offset = 1 - startWeekday; offset <= 0; offset++) {
    cells.push({ date: new Date(year, monthIndex, offset), inMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push({ date: new Date(year, monthIndex, day), inMonth: true });
  }
  while (cells.length % 7 !== 0) {
    const next = new Date(cells[cells.length - 1].date);
    next.setDate(next.getDate() + 1);
    cells.push({ date: next, inMonth: false });
  }

  return cells;
}

// The workshop's own name as the tab title; the generic label if it isn't
// visible (unknown id, not approved), where the page itself 404s.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const { clientNav } = await getDictionary(resolveLocale(lang));
  const supabase = await createClient();
  const { data } = await supabase
    .from("garages")
    .select("name")
    .eq("id", id)
    .eq("status", "approved")
    .is("deleted_at", null)
    .maybeSingle();
  return { title: data?.name ?? clientNav.garageDetails };
}

export default async function GarageDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string; id: string }>;
  searchParams: Promise<{
    service?: string;
    date?: string;
    month?: string;
    error?: string;
    waitlisted?: string;
    // The slot picked for review; nothing is booked until "Confirm".
    time?: string;
    // Vehicle to pre-select at the confirm step (lib/booking-vehicle.ts).
    vehicle?: string;
  }>;
}) {
  const { lang: rawLang, id: garageId } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageDetail;
  const fields = dictionary.garageOnboarding;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  // Public discovery/detail page -- no auth required to browse or reach the
  // booking form. `user` is only used below to personalize (own vehicles,
  // existing waitlist entry) when signed in; actually submitting a booking
  // is gated inside bookAppointment (app/actions/appointments.ts).
  const user = await getOptionalAuthedUser();
  const {
    service: serviceParam,
    date: dateParam,
    month: monthParam,
    error,
    waitlisted,
    time: timeParam,
    vehicle: vehicleParam,
  } = await searchParams;
  const bookingVehicleId = parseBookingVehicle(vehicleParam);
  // Every in-page link (service, month, day, slot) keeps the vehicle choice.
  const keepVehicle = (href: string) => withBookingVehicle(href, bookingVehicleId);

  const supabase = await createClient();

  const { data: garage } = await supabase
    .from("garages")
    .select(
      "id, name, description, address, city, phone, email, website, latitude, longitude, ev_capable, mobile_service, emergency_service, pricing_category, languages_spoken, verification_level"
    )
    .eq("id", garageId)
    .eq("status", "approved")
    .is("deleted_at", null)
    .single();

  if (!garage) {
    notFound();
  }

  // Opening hours = the weekly availability windows bookings are made from
  // (one source of truth; see lib/opening-hours.ts).
  const [{ data: availabilityRows }, { data: services }] = await Promise.all([
    supabase.from("availability").select("day_of_week, start_time, end_time").eq("garage_id", garageId),
    supabase
      .from("services")
      .select("id, name, description, category, duration_minutes")
      .eq("garage_id", garageId)
      .order("created_at", { ascending: true }),
  ]);
  const weeklyHours = summarizeWeeklyHours(availabilityRows ?? []);
  const capabilities = capabilityList(garage, fields);
  const pricingLabel =
    garage.pricing_category === "budget"
      ? fields.pricingBudget
      : garage.pricing_category === "standard"
        ? fields.pricingStandard
        : garage.pricing_category === "premium"
          ? fields.pricingPremium
          : null;
  const languageLabels = (garage.languages_spoken ?? []).map(
    (language: string) => fields.languageLabels[language as keyof typeof fields.languageLabels] ?? language
  );
  const serviceGroups = groupServicesByCategory(services ?? []);

  // Off for launch (lib/features.ts); kept wired so the switch restores it.
  const { data: reviews } = REVIEWS_ENABLED
    ? await supabase
        .from("reviews")
        .select("id, rating, comment, created_at, profiles(full_name)")
        .eq("garage_id", garageId)
        .order("created_at", { ascending: false })
    : { data: null };
  const reviewRows = (reviews ?? []) as unknown as {
    id: string;
    rating: number;
    comment: string | null;
    created_at: string;
    profiles: { full_name: string } | null;
  }[];
  const ratingAverage = averageRating(reviewRows.map((review) => review.rating));
  const verificationLevel = normalizeVerificationLevel(garage.verification_level);

  // No service is preselected: the booking card asks for one first, so the
  // first thing a client does is say what the car needs.
  const selectedService = services?.find((service) => service.id === serviceParam);

  // "Today" is the garage's local date, not the server's (UTC on Vercel),
  // or between 00:00 and 01:00/02:00 local time the picker would still offer
  // yesterday. The calendar grid itself is pure date-key arithmetic.
  const todayKey = todayKeyInAppZone();
  const requestedDate =
    dateParam && /^\d{4}-\d{2}-\d{2}$/.test(dateParam) && dateParam >= todayKey ? dateParam : null;

  const [todayYear, todayMonth] = todayKey.split("-").map(Number);
  const currentMonth = { year: todayYear, monthIndex: todayMonth - 1 };
  const { year, monthIndex } = parseMonthKey(monthParam, currentMonth);
  const displayedMonthKey = monthKey(year, monthIndex);
  const monthLabel = dateKeyToDisplayDate(`${displayedMonthKey}-01`).toLocaleDateString(dateLocale, {
    timeZone: APP_TIME_ZONE,
    month: "long",
    year: "numeric",
  });
  const calendarCells = buildCalendarGrid(year, monthIndex);

  // Days the workshop is closed (no weekly hours that weekday, or a closed
  // override) can't be picked. Same rules as slot computation
  // (lib/closed-days.ts mirrors lib/availability.ts).
  const monthKeys = calendarCells.filter((cell) => cell.inMonth).map((cell) => toDateKey(cell.date));
  const { data: overrideRows } = await supabase
    .from("availability_overrides")
    .select("date, is_closed")
    .eq("garage_id", garageId)
    .gte("date", monthKeys[0])
    .lte("date", monthKeys[monthKeys.length - 1]);
  const closedDays = closedDateKeys({
    dateKeys: monthKeys,
    openWeekdays: new Set((availabilityRows ?? []).map((row) => row.day_of_week)),
    overrides: overrideRows ?? [],
  });
  const isPickable = (key: string) => key >= todayKey && !closedDays.has(key);
  // Without a chosen date, open on the first day the workshop is open this
  // month rather than on a closed "today".
  const selectedDate = requestedDate ?? monthKeys.find(isPickable) ?? todayKey;

  const prevMonthDate = new Date(year, monthIndex - 1, 1);
  const nextMonthDate = new Date(year, monthIndex + 1, 1);
  const prevMonthKey = monthKey(prevMonthDate.getFullYear(), prevMonthDate.getMonth());
  const nextMonthKeyValue = monthKey(nextMonthDate.getFullYear(), nextMonthDate.getMonth());
  const currentMonthKey = monthKey(currentMonth.year, currentMonth.monthIndex);
  const canGoPrevMonth = displayedMonthKey > currentMonthKey;
  const maxMonthDate = new Date(currentMonth.year, currentMonth.monthIndex + 3, 1);
  const canGoNextMonth = nextMonthKeyValue <= monthKey(maxMonthDate.getFullYear(), maxMonthDate.getMonth());

  let slots: string[] = [];
  let isClosedOverride = false;
  let alreadyOnWaitlist = false;
  if (selectedService) {
    const result = await getAvailableSlotsForDate({
      supabase,
      garageId,
      date: selectedDate,
      durationMinutes: selectedService.duration_minutes,
    });
    slots = result.slots;
    isClosedOverride = result.isClosed;

    if (slots.length === 0 && user) {
      const { data: waitlistEntry } = await supabase
        .from("waitlist")
        .select("id")
        .eq("garage_id", garageId)
        .eq("client_id", user.id)
        .eq("service_id", selectedService.id)
        .eq("date", selectedDate)
        .maybeSingle();
      alreadyOnWaitlist = Boolean(waitlistEntry);
    }
  }

  // ?time= only selects a slot for review; it must still be one of the
  // offered slots (it may have been taken since the link was opened).
  const selectedTime = timeParam && slots.includes(timeParam) ? timeParam : null;
  const staleTime = Boolean(timeParam) && !selectedTime;
  const selectedDateLabel = dateKeyToDisplayDate(selectedDate).toLocaleDateString(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const pageHref = (query: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) if (value) params.set(key, value);
    return keepVehicle(`/${lang}/garages/${garageId}?${params.toString()}`);
  };
  const month = monthParam ? displayedMonthKey : undefined;

  const { data: vehicles } = user
    ? await supabase
        .from("vehicles")
        .select("id, model, year, license_plate, brands(name)")
        .eq("client_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  const vehicleRows = (vehicles ?? []) as unknown as {
    id: string;
    model: string | null;
    year: number | null;
    license_plate: string | null;
    brands: { name: string } | null;
  }[];

  const vehicleLabel = (vehicle: (typeof vehicleRows)[number]) =>
    [[vehicle.brands?.name, vehicle.model, vehicle.year].filter(Boolean).join(" "), vehicle.license_plate]
      .filter(Boolean)
      .join(", ") || d.vehicleFallback;

  const errorMessage = error ? d.errors[error as keyof typeof d.errors] : undefined;

  return (
    <div className={CLIENT_PAGE}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        <Link href={keepVehicle(`/${lang}/garages`)} className={`${CLIENT_TEXT_LINK} self-start`}>
          <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
          {d.backToGarages}
        </Link>

        {/* Header: who, where, what they offer. */}
        <header className={`${CLIENT_CARD} flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-6`}>
          <span
            aria-hidden
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-ink font-display text-2xl font-bold tracking-[-0.02em] text-surface"
          >
            {monogram(garage.name)}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{garage.name}</h1>
            {(garage.address || garage.city) && (
              <p className="inline-flex items-center gap-1.5 text-sm text-ink-muted">
                <MapPin aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                {[garage.address, garage.city].filter(Boolean).join(", ")}
              </p>
            )}
            <ul className="flex flex-wrap items-center gap-2 pt-1" aria-label={fields.servicesCapabilitiesTitle}>
              <li>
                <VerificationBadge level={verificationLevel} labels={dictionary.verificationLevels} />
              </li>
              {REVIEWS_ENABLED && ratingAverage !== null && (
                <li>
                  <RatingPill
                    average={ratingAverage}
                    count={reviewRows.length}
                    label={dictionary.common.ratingSummary
                      .replace("{rating}", ratingAverage.toFixed(1))
                      .replace("{count}", String(reviewRows.length))}
                  />
                </li>
              )}
              {capabilities.map(({ key, icon, label }) => (
                <li key={key}>
                  <CapabilityPill icon={icon} label={label} />
                </li>
              ))}
              {pricingLabel && (
                <li className="inline-flex items-center rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold text-ink-muted">
                  {fields.pricingCategoryLabel}: {pricingLabel}
                </li>
              )}
            </ul>
          </div>
        </header>

        <div className="grid grid-cols-1 items-start gap-8 lg:grid-cols-12">
          {/* Left: what the car needs, then everything about the workshop. */}
          <div className="flex min-w-0 flex-col gap-8 lg:col-span-7">
            <section id="book" aria-labelledby="services-title" className="flex scroll-mt-6 flex-col gap-5">
              <div className="flex flex-col gap-1">
                <h2 id="services-title" className="text-xl font-bold tracking-tight text-ink">
                  {d.chooseService}
                </h2>
              </div>

              {serviceGroups.length > 0 ? (
                serviceGroups.map((group) => (
                  <section
                    key={group.category}
                    aria-labelledby={`service-category-${group.category}`}
                    className="flex flex-col gap-2.5"
                  >
                    <h3 id={`service-category-${group.category}`} className={CLIENT_SECTION_LABEL}>
                      {dictionary.serviceCategories[group.category]}
                    </h3>
                    <ul className="flex flex-col gap-2.5">
                      {group.services.map((service) => {
                        const selected = selectedService?.id === service.id;
                        return (
                          <li key={service.id}>
                            <Link
                              href={pageHref({ service: service.id, date: dateParam, month })}
                              scroll={false}
                              aria-current={selected ? "true" : undefined}
                              className={`flex items-start gap-4 rounded-2xl border bg-surface p-4 transition-all sm:p-5 ${
                                selected
                                  ? "border-ink shadow-[0_2px_8px_rgba(0,0,0,0.06)] ring-1 ring-ink"
                                  : "border-zinc-200/70 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-zinc-300 dark:border-hairline dark:shadow-none dark:hover:border-ink-muted/40"
                              }`}
                            >
                              {/* Radio indicator */}
                              <span
                                aria-hidden
                                className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${
                                  selected ? "border-ink bg-ink text-surface" : "border-hairline"
                                }`}
                              >
                                {selected && <Check className="h-3 w-3" strokeWidth={3.5} />}
                              </span>
                              <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <span className="text-base font-bold tracking-tight text-ink">{service.name}</span>
                                {service.description && (
                                  <span className="text-sm text-ink-muted">{service.description}</span>
                                )}
                                <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-muted">
                                  <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                                  {service.duration_minutes} {d.min}
                                </span>
                                {selected && <span className="sr-only">{d.selected}</span>}
                              </span>
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))
              ) : (
                <p className={`${CLIENT_CARD} p-6 text-sm text-ink-muted`}>{d.noServicesYet}</p>
              )}
            </section>

            <section aria-labelledby="info-title" className="flex flex-col gap-4">
              <h2 id="info-title" className="text-xl font-bold tracking-tight text-ink">
                {d.infoTitle}
              </h2>

              {garage.description && (
                <div className={`${CLIENT_CARD} flex flex-col gap-2 p-5 sm:p-6`}>
                  <h3 className={CARD_HEADING}>{d.aboutTitle}</h3>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-ink-muted">{garage.description}</p>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={`${CLIENT_CARD} flex flex-col gap-3 p-5 sm:p-6`}>
                  <h3 className={CARD_HEADING}>{fields.openingHoursTitle}</h3>
                  {hasAnyOpeningHours(weeklyHours) ? (
                    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                      {weeklyHours.map((day) => (
                        <div key={day.dayOfWeek} className="contents">
                          <dt className="text-ink-muted">{fields.days[day.dayOfWeek]}</dt>
                          <dd className="text-right font-medium tabular-nums text-ink">
                            {day.ranges.length > 0 ? day.ranges.join(", ") : fields.closed}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  ) : (
                    <p className="text-sm text-ink-muted">{d.hoursNotPublished}</p>
                  )}
                </div>

                <div className={`${CLIENT_CARD} flex flex-col gap-3 p-5 sm:p-6`}>
                  <h3 className={CARD_HEADING}>{d.contactTitle}</h3>
                  {garage.phone || garage.email || garage.website ? (
                    <ul className="flex flex-col gap-2.5 text-sm">
                      {garage.phone && (
                        <li>
                          <a
                            href={`tel:${garage.phone.replace(/[^\d+]/g, "")}`}
                            className="flex items-center gap-2 font-medium text-ink underline-offset-4 hover:underline"
                          >
                            <Phone aria-hidden className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
                            {garage.phone}
                          </a>
                        </li>
                      )}
                      {garage.email && (
                        <li>
                          <a
                            href={`mailto:${garage.email}`}
                            className="flex items-center gap-2 break-all font-medium text-ink underline-offset-4 hover:underline"
                          >
                            <Mail aria-hidden className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
                            {garage.email}
                          </a>
                        </li>
                      )}
                      {garage.website && (
                        <li>
                          <a
                            href={garage.website}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                            className="flex items-center gap-2 break-all font-medium text-ink underline-offset-4 hover:underline"
                          >
                            <Globe aria-hidden className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
                            {garage.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          </a>
                        </li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-sm text-ink-muted">{d.noContactDetails}</p>
                  )}
                  {languageLabels.length > 0 && (
                    <p className="border-t border-hairline pt-3 text-sm text-ink-muted">
                      <span className="font-semibold text-ink">{fields.languagesSpokenLabel}:</span>{" "}
                      {languageLabels.join(", ")}
                    </p>
                  )}
                </div>
              </div>

              {garage.latitude !== null && garage.longitude !== null && (
                <GarageMapDisplay
                  latitude={garage.latitude}
                  longitude={garage.longitude}
                  className={`${CLIENT_CARD} h-64 w-full overflow-hidden`}
                />
              )}
            </section>

            {REVIEWS_ENABLED && (
              <section aria-labelledby="reviews-title" className="flex flex-col gap-4">
                <h2 id="reviews-title" className="text-xl font-bold tracking-tight text-ink">
                  {d.reviews}
                </h2>
                {reviewRows.length > 0 ? (
                  reviewRows.map((review) => (
                    <div key={review.id} className={`${CLIENT_CARD} flex flex-col gap-2 p-5`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-semibold text-ink">
                          {review.profiles?.full_name ?? d.clientFallback}
                        </span>
                        <StarRating
                          rating={review.rating}
                          label={dictionary.common.ratingOutOf.replace("{rating}", String(review.rating))}
                        />
                      </div>
                      {review.comment && <p className="text-sm text-ink-muted">{review.comment}</p>}
                      <p className="text-xs tabular-nums text-ink-muted">
                        {new Date(review.created_at).toLocaleDateString(dateLocale, { timeZone: APP_TIME_ZONE })}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-ink-muted">{d.noReviewsYet}</p>
                )}
              </section>
            )}
          </div>

          {/* Right: the booking card stays in view while the services
              scroll, so date, time and confirmation are always at hand. */}
          <aside
            aria-labelledby="booking-title"
            className={`${CLIENT_CARD} flex flex-col lg:sticky lg:top-6 lg:col-span-5 lg:max-h-[calc(100dvh-3rem)] lg:overflow-y-auto`}
          >
            <div className="flex flex-col gap-1 border-b border-hairline px-5 py-4 sm:px-6">
              <h2 id="booking-title" className="text-lg font-bold tracking-tight text-ink">
                {d.yourAppointment}
              </h2>
              {selectedService ? (
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
                  <span className="font-semibold text-ink">{selectedService.name}</span>
                  <span className="inline-flex items-center gap-1 tabular-nums">
                    <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                    {selectedService.duration_minutes} {d.min}
                  </span>
                </p>
              ) : (
                <p className="text-sm text-ink-muted">{d.pickServiceFirst}</p>
              )}
            </div>

            {(errorMessage || waitlisted === "1") && (
              <div className="px-5 pt-4 sm:px-6">
                {errorMessage && (
                  <p
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
                  >
                    {errorMessage}
                  </p>
                )}
                {waitlisted === "1" && (
                  <p
                    role="status"
                    className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    {d.waitlistedNotice}
                  </p>
                )}
              </div>
            )}

            {selectedService && (
              <>
                {/* Date */}
                <div className="flex flex-col gap-3 px-5 py-5 sm:px-6">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className={CARD_HEADING}>{d.chooseDate}</h3>
                    <div className="flex items-center gap-1">
                      {canGoPrevMonth ? (
                        <Link
                          href={pageHref({ service: selectedService.id, date: selectedDate, month: prevMonthKey })}
                          scroll={false}
                          aria-label={d.previousMonth}
                          className={MONTH_NAV}
                        >
                          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                        </Link>
                      ) : (
                        <span aria-hidden className={`${MONTH_NAV} opacity-30`}>
                          <ChevronLeft className="h-4 w-4" strokeWidth={2} />
                        </span>
                      )}
                      <span className="min-w-32 text-center text-sm font-semibold capitalize text-ink">{monthLabel}</span>
                      {canGoNextMonth ? (
                        <Link
                          href={pageHref({ service: selectedService.id, date: selectedDate, month: nextMonthKeyValue })}
                          scroll={false}
                          aria-label={d.nextMonth}
                          className={MONTH_NAV}
                        >
                          <ChevronRight className="h-4 w-4" strokeWidth={2} />
                        </Link>
                      ) : (
                        <span aria-hidden className={`${MONTH_NAV} opacity-30`}>
                          <ChevronRight className="h-4 w-4" strokeWidth={2} />
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-ink-muted">
                    {d.weekdays.map((label: string, index: number) => (
                      <span key={index}>{label}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {calendarCells.map(({ date, inMonth }) => {
                      const key = toDateKey(date);
                      const selectable = inMonth && isPickable(key);
                      const closed = inMonth && key >= todayKey && closedDays.has(key);
                      const isSelected = key === selectedDate;

                      if (!selectable) {
                        return (
                          <span
                            key={key}
                            aria-disabled="true"
                            title={closed ? fields.closed : undefined}
                            className={`flex h-10 items-center justify-center rounded-lg text-sm tabular-nums ${
                              closed ? "text-ink-muted/50 line-through decoration-ink-muted/40" : "text-ink-muted/30"
                            }`}
                          >
                            {date.getDate()}
                            {closed && <span className="sr-only">, {fields.closed}</span>}
                          </span>
                        );
                      }

                      return (
                        <Link
                          key={key}
                          href={pageHref({ service: selectedService.id, date: key, month: displayedMonthKey })}
                          scroll={false}
                          aria-current={isSelected ? "date" : undefined}
                          className={
                            isSelected
                              ? "flex h-10 items-center justify-center rounded-lg bg-brand-600 text-sm font-bold tabular-nums text-white dark:bg-brand-500"
                              : `flex h-10 items-center justify-center rounded-lg text-sm font-medium tabular-nums text-ink transition-colors hover:bg-subtle ${
                                  key === todayKey ? "ring-1 ring-inset ring-hairline" : ""
                                }`
                          }
                        >
                          {date.getDate()}
                        </Link>
                      );
                    })}
                  </div>
                </div>

                {/* Time */}
                <div className="flex flex-col gap-3 border-t border-hairline px-5 py-5 sm:px-6">
                  <h3 className={CARD_HEADING}>
                    {d.availableTimes}
                    <span className="ml-2 font-medium capitalize text-ink-muted">{selectedDateLabel}</span>
                  </h3>
                  {staleTime && (
                    <p
                      role="alert"
                      className="rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300"
                    >
                      {d.timeNoLongerAvailable}
                    </p>
                  )}
                  {slots.length > 0 ? (
                    // Links, not submit buttons: a click only selects (?time=),
                    // it never books.
                    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {slots.map((slot) => {
                        const isSelectedSlot = slot === selectedTime;
                        return (
                          <Link
                            key={slot}
                            href={pageHref({
                              service: selectedService.id,
                              date: selectedDate,
                              month,
                              time: slot,
                            })}
                            scroll={false}
                            aria-current={isSelectedSlot ? "true" : undefined}
                            className={
                              isSelectedSlot
                                ? "rounded-lg border border-brand-600 bg-brand-600 py-2.5 text-center text-sm font-semibold tabular-nums text-white dark:border-brand-500 dark:bg-brand-500"
                                : "rounded-lg border border-hairline bg-surface py-2.5 text-center text-sm font-semibold tabular-nums text-ink transition-colors hover:border-ink/30 hover:bg-subtle"
                            }
                          >
                            {slot}
                          </Link>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-start gap-3">
                      <p className="text-sm text-ink-muted">{isClosedOverride ? d.closedOnDate : d.noOpenTimes}</p>
                      {alreadyOnWaitlist ? (
                        <p className="text-sm font-medium text-ink">{d.alreadyOnWaitlistForDate}</p>
                      ) : (
                        <form action={joinWaitlist}>
                          <input type="hidden" name="garageId" value={garageId} />
                          <input type="hidden" name="serviceId" value={selectedService.id} />
                          <input type="hidden" name="date" value={selectedDate} />
                          <input type="hidden" name="lang" value={lang} />
                          <button type="submit" className={CLIENT_SECONDARY_BUTTON}>
                            <BellPlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                            {d.joinWaitlistForDate}
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>

                {/* Vehicle and confirmation: the form exists once a slot is
                    chosen; until then the button says what's missing. */}
                <div className="flex flex-col gap-4 border-t border-hairline px-5 py-5 sm:px-6">
                  {selectedTime ? (
                    <form id="confirm-booking" action={bookAppointment} className="flex flex-col gap-4">
                      <input type="hidden" name="garageId" value={garageId} />
                      <input type="hidden" name="serviceId" value={selectedService.id} />
                      <input type="hidden" name="date" value={selectedDate} />
                      <input type="hidden" name="startTime" value={selectedTime} />
                      <input type="hidden" name="lang" value={lang} />

                      <p className="rounded-xl bg-subtle px-4 py-3 text-sm text-ink">
                        <span className="font-semibold capitalize">{selectedDateLabel}</span>
                        <span className="tabular-nums">, {selectedTime}</span>
                        <span className="block text-ink-muted">{garage.name}</span>
                      </p>

                      {vehicleRows.length > 0 ? (
                        <div className="flex flex-col gap-1.5">
                          <label htmlFor="vehicleId" className={CARD_HEADING}>
                            {d.vehicleLabel}
                          </label>
                          <select
                            id="vehicleId"
                            name="vehicleId"
                            defaultValue={
                              vehicleRows.find((vehicle) => vehicle.id === bookingVehicleId)?.id ?? vehicleRows[0].id
                            }
                            className={FIELD}
                          >
                            <option value="">{d.noVehicleSpecified}</option>
                            {vehicleRows.map((vehicle) => (
                              <option key={vehicle.id} value={vehicle.id}>
                                {vehicleLabel(vehicle)}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        user && (
                          <Link href={`/${lang}/vehicles`} className={`${CLIENT_TEXT_LINK} self-start`}>
                            {d.addVehicleFaster}
                          </Link>
                        )
                      )}

                      <p className="flex items-start gap-2 text-sm text-ink-muted">
                        <Banknote aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
                        {d.payOnSiteNotice}
                      </p>
                      <label className="flex items-start gap-2.5 text-sm text-ink">
                        <input type="checkbox" name="termsAccepted" required className="mt-0.5 h-4 w-4 accent-ink" />
                        <span>
                          {d.agreeToThe}{" "}
                          <Link href={`/${lang}/privacy`} className="font-medium underline underline-offset-4">
                            {d.bookingTermsLink}
                          </Link>
                          .
                        </span>
                      </label>
                      <SubmitButton pendingLabel={d.confirming} className={`${CLIENT_PRIMARY_BUTTON} w-full py-3`}>
                        {d.confirmBooking}
                      </SubmitButton>
                    </form>
                  ) : (
                    slots.length > 0 && (
                      <button
                        type="button"
                        disabled
                        className={`${CLIENT_PRIMARY_BUTTON} w-full cursor-not-allowed py-3 opacity-40`}
                      >
                        {d.pickTimeFirst}
                      </button>
                    )
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
