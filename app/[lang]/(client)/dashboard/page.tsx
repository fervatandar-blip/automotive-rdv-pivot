import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  CalendarClock,
  CalendarPlus,
  Car,
  Check,
  ChevronRight,
  FileText,
  MapPin,
  MessageSquare,
  Navigation,
} from "lucide-react";
import { getAuthedProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { logout } from "@/app/actions/auth";
import { submitReview } from "@/app/actions/reviews";
import { leaveWaitlist } from "@/app/actions/waitlist";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { EmptyStateCard } from "@/components/empty-state-card";
import { LicensePlate } from "@/components/license-plate";
import { CancelBookingButton } from "./cancel-booking-button";
import { REPAIR_STAGES } from "@/lib/definitions";
import { APP_TIME_ZONE, dateKeyToDisplayDate } from "@/lib/timezone";
import { directionsUrl, mapSearchUrl } from "@/lib/maps";
import {
  CLIENT_CARD,
  CLIENT_DANGER_PILL,
  CLIENT_DIVIDE,
  CLIENT_PAGE,
  CLIENT_PAGE_TITLE,
  CLIENT_PILL_ICON,
  CLIENT_SECTION_LABEL,
  CLIENT_TINTED_PILL,
} from "@/lib/client-ui";

type Appointment = {
  id: string;
  start_time: string;
  status: string;
  repair_stage: string | null;
  services: { name: string } | null;
  garages: {
    name: string;
    city: string | null;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  vehicles: {
    model: string | null;
    year: number | null;
    license_plate: string | null;
    brands: { name: string } | null;
  } | null;
};

type StepStatus = "complete" | "current" | "upcoming";

function RepairStageIndicator({
  steps,
}: {
  steps: { label: string; status: StepStatus }[];
}) {
  return (
    <div className="flex items-center">
      {steps.map((step, index) => (
        <div key={step.label} className="flex flex-1 items-center last:flex-none">
          <div className="flex flex-col items-center gap-1.5">
            <div
              className={
                step.status === "complete"
                  ? "flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-white dark:bg-brand-500"
                  : step.status === "current"
                    ? "flex h-7 w-7 items-center justify-center rounded-full border-2 border-brand-600 text-brand-600 dark:border-brand-500 dark:text-brand-400"
                    : "flex h-7 w-7 items-center justify-center rounded-full border-2 border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
              }
            >
              {step.status === "complete" ? (
                <Check className="h-4 w-4" strokeWidth={2.5} />
              ) : (
                <span className="text-xs font-semibold">{index + 1}</span>
              )}
            </div>
            <span
              className={
                step.status === "upcoming"
                  ? "text-xs font-medium text-zinc-400 dark:text-zinc-500"
                  : "text-xs font-medium text-black dark:text-zinc-50"
              }
            >
              {step.label}
            </span>
          </div>
          {index < steps.length - 1 && (
            <div
              className={
                step.status === "complete"
                  ? "mx-2 h-0.5 flex-1 rounded-full bg-brand-600 dark:bg-brand-500"
                  : "mx-2 h-0.5 flex-1 rounded-full bg-black/[.08] dark:bg-white/[.145]"
              }
            />
          )}
        </div>
      ))}
    </div>
  );
}

function repairStageSteps(
  currentStage: string | null,
  stageLabels: Dictionary["common"]["repairStage"]
) {
  const currentIndex = currentStage
    ? REPAIR_STAGES.indexOf(currentStage as (typeof REPAIR_STAGES)[number])
    : -1;

  return REPAIR_STAGES.map((stage, index) => ({
    label: stageLabels[stage],
    status: (index < currentIndex
      ? "complete"
      : index === currentIndex
        ? "current"
        : "upcoming") as StepStatus,
  }));
}

function isUpcoming(appointment: { status: string; start_time: string }) {
  return (
    (appointment.status === "pending" || appointment.status === "confirmed") &&
    new Date(appointment.start_time).getTime() >= Date.now()
  );
}

function dateLocaleFor(lang: Locale) {
  return lang === "fr" ? "fr-FR" : "en-GB";
}

function formatDay(iso: string, lang: Locale) {
  return new Date(iso).toLocaleDateString(dateLocaleFor(lang), {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function formatTime(iso: string, lang: Locale) {
  return new Date(iso).toLocaleTimeString(dateLocaleFor(lang), {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

type VehicleSummary = {
  id: string;
  model: string | null;
  license_plate: string | null;
  brands: { name: string } | null;
};

const MAX_VEHICLES_IN_WIDGET = 3;
const SIDE_LINK =
  "inline-flex items-center gap-0.5 text-xs font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50";

function StatusPill({ status, d }: { status: string; d: Dictionary["clientDashboard"] }) {
  const styles: Record<string, { label: string; className: string }> = {
    confirmed: { label: d.statusConfirmed, className: "text-green-700 dark:text-green-400" },
    pending: { label: d.statusPending, className: "text-amber-700 dark:text-amber-300" },
    pending_payment: { label: d.paymentProcessing, className: "text-amber-700 dark:text-amber-300" },
    completed: { label: d.completed, className: "text-zinc-500 dark:text-zinc-400" },
    cancelled: { label: d.cancelled, className: "text-red-600 dark:text-red-400" },
  };
  const style = styles[status];
  if (!style) return null;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 text-xs font-medium ${style.className}`}>
      <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
      {style.label}
    </span>
  );
}

function ReviewForm({
  appointmentId,
  lang,
  dictionary,
}: {
  appointmentId: string;
  lang: Locale;
  dictionary: Dictionary;
}) {
  const d = dictionary.clientDashboard;
  const ratingOptions = (["5", "4", "3", "2", "1"] as const).map((value) => ({
    value,
    label: d.ratingOptions[value],
  }));

  // Collapsed by default: one tap to open instead of a form on every card.
  return (
    <details className="group border-t border-zinc-200/80 pt-3 dark:border-zinc-800/60">
      <summary className="cursor-pointer list-none text-sm font-medium text-brand-700 hover:underline dark:text-brand-400 [&::-webkit-details-marker]:hidden">
        {d.leaveAReview}
      </summary>
      <form action={submitReview} className="mt-3 flex flex-col gap-2">
        <input type="hidden" name="appointmentId" value={appointmentId} />
        <input type="hidden" name="lang" value={lang} />
        <select
          name="rating"
          defaultValue="5"
          aria-label={d.leaveAReview}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        >
          {ratingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <textarea
          name="comment"
          placeholder={d.optionalComment}
          aria-label={d.optionalComment}
          rows={2}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-950"
        />
        <button
          type="submit"
          className="self-start rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {d.submit}
        </button>
      </form>
    </details>
  );
}

function AppointmentCard({
  appointment,
  lang,
  dictionary,
  cancellable = false,
}: {
  appointment: Appointment;
  lang: Locale;
  dictionary: Dictionary;
  cancellable?: boolean;
}) {
  const d = dictionary.clientDashboard;
  const isOpen = appointment.status === "pending" || appointment.status === "confirmed";
  const vehicle = appointment.vehicles;
  const vehicleText = vehicle
    ? [vehicle.brands?.name, vehicle.model, vehicle.year].filter(Boolean).join(" ")
    : "";
  const plate = vehicle?.license_plate?.trim();
  const garage = appointment.garages;
  const garageName = garage?.name ?? d.garageFallback;
  // City keeps the line short; the link itself targets the exact pin/address.
  const place = garage?.city?.trim() || garage?.address?.trim() || "";
  const placeUrl = garage ? mapSearchUrl(garage) : null;
  // Directions only matter for a visit that's still ahead.
  const routeUrl = cancellable && isOpen && garage ? directionsUrl(garage) : null;

  return (
    <article className={`${CLIENT_CARD} flex flex-col gap-4 p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold capitalize text-zinc-900 dark:text-zinc-50">
            {formatDay(appointment.start_time, lang)}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              {" · "}
              {formatTime(appointment.start_time, lang)}
            </span>
          </p>
          <h3 className="mt-1 text-base font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {appointment.services?.name ?? d.serviceFallback}
          </h3>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {garageName}
            {place && (
              <>
                {" · "}
                {placeUrl ? (
                  <a
                    href={placeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={d.showOnMap.replace("{place}", place)}
                    className="inline-flex items-center gap-1 underline decoration-zinc-300 underline-offset-2 transition-colors hover:text-zinc-900 hover:decoration-current dark:decoration-zinc-600 dark:hover:text-zinc-100"
                  >
                    <MapPin aria-hidden className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    {place}
                  </a>
                ) : (
                  place
                )}
              </>
            )}
          </p>
        </div>
        <StatusPill status={appointment.status} d={d} />
      </div>

      {(plate || vehicleText) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
          {plate && <LicensePlate plate={plate} label={d.plateLabel} />}
          {vehicleText && <span>{vehicleText}</span>}
        </div>
      )}

      {cancellable && appointment.repair_stage && (
        <RepairStageIndicator steps={repairStageSteps(appointment.repair_stage, dictionary.common.repairStage)} />
      )}

      {/* Footer: everyday actions on the left, Cancel apart on the right. */}
      <div className="flex flex-wrap items-center gap-2 border-t border-zinc-100 pt-4 dark:border-zinc-800/60">
        <Link href={`/${lang}/messages?a=${appointment.id}`} className={CLIENT_TINTED_PILL}>
          <MessageSquare aria-hidden className={CLIENT_PILL_ICON} strokeWidth={1.75} />
          {d.message}
        </Link>
        {cancellable && isOpen && (
          <Link href={`/${lang}/appointments/${appointment.id}/reschedule`} className={CLIENT_TINTED_PILL}>
            <CalendarClock aria-hidden className={CLIENT_PILL_ICON} strokeWidth={1.75} />
            {d.reschedule}
          </Link>
        )}
        {routeUrl && (
          <a
            href={routeUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={d.directionsTo.replace("{name}", garageName)}
            className={CLIENT_TINTED_PILL}
          >
            <Navigation aria-hidden className={CLIENT_PILL_ICON} strokeWidth={1.75} />
            {d.directions}
          </a>
        )}
        {cancellable && isOpen && (
          <CancelBookingButton
            appointmentId={appointment.id}
            lang={lang}
            labels={{
              cancel: d.cancel,
              confirm: d.cancelConfirm,
              yes: d.cancelConfirmYes,
              keep: d.cancelKeep,
              cancelling: d.cancelling,
              failed: d.cancelFailed,
              notAllowed: d.cancelNotAllowed,
            }}
          />
        )}
      </div>

    </article>
  );
}

const TEXT_ACTION =
  "inline-flex items-center gap-1 text-xs font-medium text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline dark:text-zinc-400 dark:hover:text-zinc-100";

/** One line of the service history: what, where, which car, outcome. */
function PastServiceRow({
  appointment,
  lang,
  dictionary,
  invoiceUrl,
  reviewable,
}: {
  appointment: Appointment;
  lang: Locale;
  dictionary: Dictionary;
  invoiceUrl?: string;
  reviewable: boolean;
}) {
  const d = dictionary.clientDashboard;
  const garageName = appointment.garages?.name ?? d.garageFallback;
  const plate = appointment.vehicles?.license_plate?.trim();
  const date = new Date(appointment.start_time);

  return (
    <li className="flex flex-col gap-2 px-4 py-3.5 sm:px-5">
      <div className="flex items-start gap-4">
        <time
          dateTime={appointment.start_time}
          className="w-14 shrink-0 text-center text-xs font-medium uppercase leading-tight text-zinc-500 dark:text-zinc-400"
        >
          <span className="block text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            {date.toLocaleDateString(dateLocaleFor(lang), { timeZone: APP_TIME_ZONE, day: "numeric" })}
          </span>
          {date.toLocaleDateString(dateLocaleFor(lang), { timeZone: APP_TIME_ZONE, month: "short", year: "2-digit" })}
        </time>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <p className="truncate font-medium text-zinc-900 dark:text-zinc-50">
              {appointment.services?.name ?? d.serviceFallback}
            </p>
            <StatusPill status={appointment.status} d={d} />
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-500 dark:text-zinc-400">
            <span className="truncate">{garageName}</span>
            {plate && <LicensePlate plate={plate} label={d.plateLabel} />}
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
            <Link
              href={`/${lang}/messages?a=${appointment.id}`}
              aria-label={d.messageWorkshop.replace("{name}", garageName)}
              className={TEXT_ACTION}
            >
              <MessageSquare aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {d.message}
            </Link>
            {invoiceUrl && (
              <a href={invoiceUrl} className={TEXT_ACTION}>
                <FileText aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
                {d.downloadInvoice}
              </a>
            )}
          </div>
          {reviewable && (
            <div className="mt-3">
              <ReviewForm appointmentId={appointment.id} lang={lang} dictionary={dictionary} />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}

function LogoutButton({ lang, dictionary }: { lang: Locale; dictionary: Dictionary }) {
  return (
    <form action={logout}>
      <input type="hidden" name="lang" value={lang} />
      <button
        type="submit"
        className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
      >
        {dictionary.clientDashboard.logOut}
      </button>
    </form>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const { clientNav } = await getDictionary(resolveLocale(lang));
  return { title: clientNav.dashboard };
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ booked?: string; reviewError?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.clientDashboard;
  const profile = await getAuthedProfile(lang);

  if (profile.role === "admin_garage" || profile.role === "mecanicien") {
    redirect(`/${lang}/garage/dashboard`);
  }

  if (profile.role === "super_admin") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-16 dark:bg-black">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {d.welcomePrefix} {profile.full_name || profile.email}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {d.rolePrefix} {profile.role}
          </p>
          <div className="flex gap-4 text-sm font-medium underline">
            <Link href={`/${lang}/admin/stats`}>{d.overview}</Link>
            <Link href={`/${lang}/admin/garages`}>{d.garagesNav}</Link>
            <Link href={`/${lang}/admin/leads`}>{d.leadsNav}</Link>
          </div>
          <Link
            href={`/${lang}/account`}
            className="text-sm font-medium underline"
          >
            {d.account}
          </Link>
          <LanguageSwitcher lang={lang} />
          <LogoutButton lang={lang} dictionary={dictionary} />
        </div>
      </div>
    );
  }

  const { booked, reviewError } = await searchParams;
  const supabase = await createClient();

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, start_time, status, repair_stage, services(name), garages!appointments_garage_id_fkey(name, city, address, latitude, longitude), vehicles(model, year, license_plate, brands(name))"
    )
    .eq("client_id", profile.id)
    .order("start_time", { ascending: true });

  const rows = (appointments ?? []) as unknown as Appointment[];
  const upcoming = rows.filter(isUpcoming);
  const other = rows.filter((appointment) => !isUpcoming(appointment));

  const completedIds = rows
    .filter((appointment) => appointment.status === "completed")
    .map((appointment) => appointment.id);

  const invoiceUrls = new Map<string, string>();
  if (completedIds.length > 0) {
    const { data: invoices } = await supabase
      .from("invoices")
      .select("appointment_id, file_path")
      .in("appointment_id", completedIds);

    for (const invoice of invoices ?? []) {
      const { data } = await supabase.storage
        .from("invoices")
        .createSignedUrl(invoice.file_path, 60 * 10);
      if (data?.signedUrl) {
        invoiceUrls.set(invoice.appointment_id, data.signedUrl);
      }
    }
  }

  const reviewedAppointmentIds = new Set<string>();
  if (completedIds.length > 0) {
    const { data: reviews } = await supabase
      .from("reviews")
      .select("appointment_id")
      .in("appointment_id", completedIds);

    for (const review of reviews ?? []) {
      reviewedAppointmentIds.add(review.appointment_id);
    }
  }

  const [{ data: waitlistEntries }, { data: vehicleRows }] = await Promise.all([
    supabase
      .from("waitlist")
      .select("id, date, notified_at, services(name), garages(name)")
      .eq("client_id", profile.id)
      .order("date", { ascending: true }),
    supabase
      .from("vehicles")
      .select("id, model, license_plate, brands(name)")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false }),
  ]);
  const vehicles = (vehicleRows ?? []) as unknown as VehicleSummary[];

  const waitlistRows = (waitlistEntries ?? []) as unknown as {
    id: string;
    date: string;
    notified_at: string | null;
    services: { name: string } | null;
    garages: { name: string } | null;
  }[];

  // Most recent first: last week's service matters more than last year's.
  const past = [...other].reverse();
  const firstName = (profile.full_name || "").trim().split(/\s+/)[0];

  const v = dictionary.vehicles;

  const upcomingSection = (
    <section aria-labelledby="upcoming-title" className="flex flex-col gap-3">
      <h2 id="upcoming-title" className={CLIENT_SECTION_LABEL}>
        {d.upcoming}
      </h2>
      {upcoming.length > 0 ? (
        upcoming.map((appointment) => (
          <AppointmentCard
            key={appointment.id}
            appointment={appointment}
            lang={lang}
            dictionary={dictionary}
            cancellable
          />
        ))
      ) : (
        <EmptyStateCard
          icon={CalendarPlus}
          title={d.noUpcomingTitle}
          description={d.noUpcomingDescription}
          ctaHref={`/${lang}/garages`}
          ctaLabel={d.findAGarage}
        />
      )}
    </section>
  );

  const historySection = past.length > 0 && (
    <section aria-labelledby="past-title" className="flex flex-col gap-3">
      <h2 id="past-title" className={CLIENT_SECTION_LABEL}>
        {d.pastServiceHistory}
      </h2>
      <ol className={`${CLIENT_CARD} ${CLIENT_DIVIDE}`}>
        {past.map((appointment) => (
          <PastServiceRow
            key={appointment.id}
            appointment={appointment}
            lang={lang}
            dictionary={dictionary}
            invoiceUrl={invoiceUrls.get(appointment.id)}
            reviewable={appointment.status === "completed" && !reviewedAppointmentIds.has(appointment.id)}
          />
        ))}
      </ol>
    </section>
  );

  const shownVehicles = vehicles.slice(0, MAX_VEHICLES_IN_WIDGET);
  const hiddenVehicles = vehicles.length - shownVehicles.length;

  const sideColumn = (
    <aside className="flex flex-col gap-6">
      {waitlistRows.length > 0 && (
        <section aria-labelledby="waitlist-title" className="flex flex-col gap-3">
          <h2 id="waitlist-title" className={CLIENT_SECTION_LABEL}>
            {d.waitlist}
          </h2>
          <ul className={`${CLIENT_CARD} ${CLIENT_DIVIDE}`}>
            {waitlistRows.map((entry) => (
              <li key={entry.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                    {entry.services?.name ?? d.serviceFallback}
                  </p>
                  <p className="text-xs text-zinc-500 dark:text-zinc-400">
                    {entry.garages?.name ?? d.garageFallback} ·{" "}
                    <span className="capitalize">
                      {dateKeyToDisplayDate(entry.date).toLocaleDateString(dateLocaleFor(lang), {
                        timeZone: APP_TIME_ZONE,
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </p>
                  {entry.notified_at && (
                    <p className="mt-1 text-xs font-medium text-amber-700 dark:text-amber-300">
                      {d.waitlistSlotOpened}
                    </p>
                  )}
                </div>
                <form action={leaveWaitlist} className="shrink-0">
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="lang" value={lang} />
                  <button type="submit" className={CLIENT_DANGER_PILL}>
                    {d.leave}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="vehicles-title" className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h2 id="vehicles-title" className={CLIENT_SECTION_LABEL}>
            {dictionary.clientNav.vehicles}
          </h2>
          {vehicles.length > 0 && (
            <Link href={`/${lang}/vehicles`} className={SIDE_LINK}>
              {d.manageVehicles}
              <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            </Link>
          )}
        </div>
        {vehicles.length > 0 ? (
          <ul className={`${CLIENT_CARD} ${CLIENT_DIVIDE}`}>
            {shownVehicles.map((vehicle) => {
              const name = [vehicle.brands?.name, vehicle.model].filter(Boolean).join(" ") || v.vehicleFallback;
              const plate = vehicle.license_plate?.trim();
              return (
                <li key={vehicle.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500 dark:bg-zinc-800/60 dark:text-zinc-400">
                    <Car aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">{name}</p>
                    {plate && (
                      <span className="self-start">
                        <LicensePlate plate={plate} label={d.plateLabel} />
                      </span>
                    )}
                  </div>
                  <Link
                    href={`/${lang}/garages?vehicle=${vehicle.id}`}
                    aria-label={v.bookServiceFor.replace("{vehicle}", name)}
                    title={v.bookService}
                    className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-brand-600 transition-colors hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:text-brand-400 dark:hover:bg-brand-500/10"
                  >
                    <CalendarPlus aria-hidden className="h-4 w-4" strokeWidth={1.75} />
                  </Link>
                </li>
              );
            })}
            {hiddenVehicles > 0 && (
              <li className="px-4 py-2.5">
                <Link href={`/${lang}/vehicles`} className={SIDE_LINK}>
                  {d.moreVehicles.replace("{count}", String(hiddenVehicles))}
                </Link>
              </li>
            )}
          </ul>
        ) : (
          <div className={`${CLIENT_CARD} flex flex-col items-start gap-2 p-4`}>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{d.noVehiclesHint}</p>
            <Link href={`/${lang}/vehicles`} className={CLIENT_TINTED_PILL}>
              <Car aria-hidden className={CLIENT_PILL_ICON} strokeWidth={1.75} />
              {v.addVehicleButton}
            </Link>
          </div>
        )}
      </section>
    </aside>
  );

  return (
    <div className={CLIENT_PAGE}>
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className={CLIENT_PAGE_TITLE}>
            {firstName ? `${d.welcomePrefix} ${firstName}` : d.welcomeFallback}
          </h1>
          <Link
            href={`/${lang}/garages`}
            className="flex h-11 items-center justify-center gap-2 rounded-full bg-brand-600 px-6 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            <CalendarPlus aria-hidden className="h-4 w-4" strokeWidth={2} />
            {d.bookAppointment}
          </Link>
        </header>

        {booked === "1" && (
          <p
            role="status"
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300"
          >
            {d.appointmentBooked}
          </p>
        )}

        {reviewError && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          >
            {reviewError === "duplicate" ? d.reviewErrorDuplicate : d.reviewErrorGeneric}
          </p>
        )}

        {/* Phones stack upcoming, then the side column (a waitlist slot that
            opened is time-sensitive), then history. From lg the side column
            spans both rows on the right; the 1fr second row soaks up any
            extra height so upcoming and history stay flush. */}
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-3 lg:grid-rows-[auto_1fr]">
          <div className="flex min-w-0 flex-col gap-8 lg:col-span-2">{upcomingSection}</div>
          <div className="min-w-0 lg:col-start-3 lg:row-span-2 lg:row-start-1">{sideColumn}</div>
          {historySection && <div className="min-w-0 lg:col-span-2">{historySection}</div>}
        </div>
      </div>
    </div>
  );
}
