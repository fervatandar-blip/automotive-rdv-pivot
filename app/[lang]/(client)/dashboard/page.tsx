import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarPlus, Car, Check } from "lucide-react";
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

type Appointment = {
  id: string;
  start_time: string;
  status: string;
  repair_stage: string | null;
  services: { name: string } | null;
  garages: { name: string; city: string | null } | null;
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

const CARD =
  "rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800/60 dark:bg-transparent";
const SECTION_LABEL =
  "text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";
const SECONDARY_BUTTON =
  "rounded-full border border-zinc-200 px-3.5 py-1.5 text-sm font-medium text-black transition-colors hover:bg-zinc-100 dark:border-zinc-700/80 dark:text-zinc-50 dark:hover:bg-zinc-800/60";

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
  invoiceUrl,
  reviewable = false,
}: {
  appointment: Appointment;
  lang: Locale;
  dictionary: Dictionary;
  cancellable?: boolean;
  invoiceUrl?: string;
  reviewable?: boolean;
}) {
  const d = dictionary.clientDashboard;
  const isOpen = appointment.status === "pending" || appointment.status === "confirmed";
  const vehicle = appointment.vehicles;
  const vehicleText = vehicle
    ? [vehicle.brands?.name, vehicle.model, vehicle.year].filter(Boolean).join(" ")
    : "";
  const plate = vehicle?.license_plate?.trim();

  return (
    <article className={`${CARD} flex flex-col gap-4 p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold capitalize text-black dark:text-zinc-50">
            {formatDay(appointment.start_time, lang)}
            <span className="font-normal text-zinc-500 dark:text-zinc-400">
              {" · "}
              {formatTime(appointment.start_time, lang)}
            </span>
          </p>
          <h3 className="mt-1 text-base font-semibold text-black dark:text-zinc-50">
            {appointment.services?.name ?? d.serviceFallback}
          </h3>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {appointment.garages?.name ?? d.garageFallback}
            {appointment.garages?.city ? ` · ${appointment.garages.city}` : ""}
          </p>
        </div>
        <StatusPill status={appointment.status} d={d} />
      </div>

      {(plate || vehicleText) && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {plate && <LicensePlate plate={plate} label={d.plateLabel} />}
          {vehicleText && <span>{vehicleText}</span>}
        </div>
      )}

      {cancellable && appointment.repair_stage && (
        <RepairStageIndicator steps={repairStageSteps(appointment.repair_stage, dictionary.common.repairStage)} />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={`/${lang}/appointments/${appointment.id}/messages`} className={SECONDARY_BUTTON}>
          {d.message}
        </Link>
        {cancellable && isOpen && (
          <Link href={`/${lang}/appointments/${appointment.id}/reschedule`} className={SECONDARY_BUTTON}>
            {d.reschedule}
          </Link>
        )}
        {invoiceUrl && (
          <a href={invoiceUrl} className={SECONDARY_BUTTON}>
            {d.downloadInvoice}
          </a>
        )}
        {cancellable && isOpen && (
          <CancelBookingButton
            appointmentId={appointment.id}
            lang={lang}
            labels={{ cancel: d.cancel, confirm: d.cancelConfirm, yes: d.cancelConfirmYes, keep: d.cancelKeep }}
          />
        )}
      </div>

      {reviewable && <ReviewForm appointmentId={appointment.id} lang={lang} dictionary={dictionary} />}
    </article>
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
      "id, start_time, status, repair_stage, services(name), garages!appointments_garage_id_fkey(name, city), vehicles(model, year, license_plate, brands(name))"
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

  const { data: waitlistEntries } = await supabase
    .from("waitlist")
    .select(
      "id, date, notified_at, services(name), garages(name)"
    )
    .eq("client_id", profile.id)
    .order("date", { ascending: true });

  const waitlistRows = (waitlistEntries ?? []) as unknown as {
    id: string;
    date: string;
    notified_at: string | null;
    services: { name: string } | null;
    garages: { name: string } | null;
  }[];

  const { data: vehicles } = await supabase
    .from("vehicles")
    .select("id, model, year, license_plate, brands(name)")
    .eq("client_id", profile.id)
    .order("created_at", { ascending: false });

  const vehicleRows = (vehicles ?? []) as unknown as {
    id: string;
    model: string | null;
    year: number | null;
    license_plate: string | null;
    brands: { name: string } | null;
  }[];

  // Most recent first: last week's service matters more than last year's.
  const past = [...other].reverse();
  const firstName = (profile.full_name || "").trim().split(/\s+/)[0];

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-3xl">
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

        <section aria-labelledby="upcoming-title" className="flex flex-col gap-3">
          <h2 id="upcoming-title" className={SECTION_LABEL}>
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

        <section aria-labelledby="vehicles-title" className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 id="vehicles-title" className={SECTION_LABEL}>
              {d.myVehicles}
            </h2>
            {vehicleRows.length > 0 && (
              <Link
                href={`/${lang}/vehicles`}
                className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
              >
                {d.manageVehicles}
                <ArrowRight aria-hidden className="h-4 w-4" />
              </Link>
            )}
          </div>
          {vehicleRows.length > 0 ? (
            <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
              {vehicleRows.map((vehicle) => (
                <li key={vehicle.id} className={`${CARD} flex w-56 shrink-0 snap-start flex-col gap-2 p-4`}>
                  <p className="font-semibold text-black dark:text-zinc-50">
                    {[vehicle.brands?.name, vehicle.model].filter(Boolean).join(" ") || d.vehicleFallback}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
                    {vehicle.license_plate && (
                      <LicensePlate plate={vehicle.license_plate} label={d.plateLabel} />
                    )}
                    {vehicle.year && <span>{vehicle.year}</span>}
                    {!vehicle.license_plate && !vehicle.year && <span>{d.noDetailsAdded}</span>}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyStateCard
              icon={Car}
              title={d.noVehiclesTitle}
              description={d.noVehiclesDescription}
              ctaHref={`/${lang}/vehicles`}
              ctaLabel={d.addVehicle}
            />
          )}
        </section>

        {waitlistRows.length > 0 && (
          <section aria-labelledby="waitlist-title" className="flex flex-col gap-3">
            <h2 id="waitlist-title" className={SECTION_LABEL}>
              {d.waitlist}
            </h2>
            <ul className={`${CARD} divide-y divide-zinc-200/80 dark:divide-zinc-800/60`}>
              {waitlistRows.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
                  <div className="min-w-0">
                    <p className="font-medium text-black dark:text-zinc-50">
                      {entry.services?.name ?? d.serviceFallback}
                    </p>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400">
                      {entry.garages?.name ?? d.garageFallback} ·{" "}
                      {dateKeyToDisplayDate(entry.date).toLocaleDateString(dateLocaleFor(lang), {
                        timeZone: APP_TIME_ZONE,
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </p>
                    {entry.notified_at && (
                      <p className="mt-1 text-sm font-medium text-amber-700 dark:text-amber-300">
                        {d.waitlistSlotOpened}
                      </p>
                    )}
                  </div>
                  <form action={leaveWaitlist}>
                    <input type="hidden" name="id" value={entry.id} />
                    <input type="hidden" name="lang" value={lang} />
                    <button
                      type="submit"
                      className="rounded-full px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                    >
                      {d.leave}
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          </section>
        )}

        {past.length > 0 && (
          <section aria-labelledby="past-title" className="flex flex-col gap-3">
            <h2 id="past-title" className={SECTION_LABEL}>
              {d.pastAndCancelled}
            </h2>
            {past.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                lang={lang}
                dictionary={dictionary}
                invoiceUrl={invoiceUrls.get(appointment.id)}
                reviewable={appointment.status === "completed" && !reviewedAppointmentIds.has(appointment.id)}
              />
            ))}
          </section>
        )}
      </div>
    </div>
  );
}
