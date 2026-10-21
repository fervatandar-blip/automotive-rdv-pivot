import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarPlus, Car, Check, Wrench } from "lucide-react";
import { getAuthedProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { logout } from "@/app/actions/auth";
import { cancelAppointment } from "@/app/actions/appointments";
import { submitReview } from "@/app/actions/reviews";
import { leaveWaitlist } from "@/app/actions/waitlist";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { EmptyStateCard } from "@/components/empty-state-card";
import { REPAIR_STAGES, REPAIR_STAGE_LABELS } from "@/lib/definitions";
import { APP_TIME_ZONE, dateKeyToDisplayDate } from "@/lib/timezone";

type Appointment = {
  id: string;
  start_time: string;
  status: string;
  repair_stage: string | null;
  services: { name: string } | null;
  garages: { name: string; city: string | null } | null;
  vehicles: { model: string | null; year: number | null } | null;
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

function repairStageSteps(currentStage: string | null) {
  const currentIndex = currentStage
    ? REPAIR_STAGES.indexOf(currentStage as (typeof REPAIR_STAGES)[number])
    : -1;

  return REPAIR_STAGES.map((stage, index) => ({
    label: REPAIR_STAGE_LABELS[stage],
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

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateHeader(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
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
  const ratingOptions = [
    { value: 5, label: dictionary.clientDashboard.ratingOptions["5"] },
    { value: 4, label: dictionary.clientDashboard.ratingOptions["4"] },
    { value: 3, label: dictionary.clientDashboard.ratingOptions["3"] },
    { value: 2, label: dictionary.clientDashboard.ratingOptions["2"] },
    { value: 1, label: dictionary.clientDashboard.ratingOptions["1"] },
  ];

  return (
    <form
      action={submitReview}
      className="mt-2 flex flex-col gap-2 border-t border-black/[.08] pt-3 dark:border-white/[.145]"
    >
      <input type="hidden" name="appointmentId" value={appointmentId} />
      <input type="hidden" name="lang" value={lang} />
      <p className="text-sm font-medium text-black dark:text-zinc-50">
        {dictionary.clientDashboard.leaveAReview}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <select
          name="rating"
          defaultValue={5}
          className="rounded-md border border-black/[.08] px-2 py-1 text-sm dark:border-white/[.145] dark:bg-black"
        >
          {ratingOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-full bg-brand-600 px-4 py-1 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {dictionary.clientDashboard.submit}
        </button>
      </div>
      <textarea
        name="comment"
        placeholder={dictionary.clientDashboard.optionalComment}
        rows={2}
        className="rounded-md border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black"
      />
    </form>
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

  return (
    <div className="flex flex-col rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 dark:bg-brand-950 dark:text-brand-400">
              <Wrench className="h-4 w-4" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="font-semibold text-black dark:text-zinc-50">
                {appointment.services?.name ?? d.serviceFallback}
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {formatDateHeader(appointment.start_time)}
              </p>
            </div>
          </div>
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {d.withGarage} {appointment.garages?.name ?? d.garageFallback}
            {appointment.garages?.city ? ` · ${appointment.garages.city}` : ""}
          </p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            {formatDateTime(appointment.start_time)}
          </p>
          {appointment.vehicles &&
            (appointment.vehicles.model || appointment.vehicles.year) && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                {[appointment.vehicles.model, appointment.vehicles.year]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            )}
          {cancellable && appointment.repair_stage && (
            <div className="mt-4 max-w-xs">
              <RepairStageIndicator
                steps={repairStageSteps(appointment.repair_stage)}
              />
            </div>
          )}
          {appointment.status === "pending_payment" && (
            <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
              {d.paymentProcessing}
            </p>
          )}
          {appointment.status === "cancelled" && (
            <p className="mt-1 text-sm text-red-600">{d.cancelled}</p>
          )}
          {appointment.status === "completed" && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {d.completed}
            </p>
          )}
          {invoiceUrl && (
            <a
              href={invoiceUrl}
              className="mt-1 inline-block text-sm font-medium underline"
            >
              {d.downloadInvoice}
            </a>
          )}
        </div>
        <div className="flex shrink-0 flex-col gap-1.5">
          <Link
            href={`/${lang}/appointments/${appointment.id}/messages`}
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-center text-sm font-medium transition-colors hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:border-white/[.145] dark:hover:border-brand-500 dark:hover:bg-brand-950 dark:hover:text-brand-400"
          >
            {d.message}
          </Link>
          {cancellable &&
            (appointment.status === "pending" ||
              appointment.status === "confirmed") && (
              <>
                <Link
                  href={`/${lang}/appointments/${appointment.id}/reschedule`}
                  className="rounded-full border border-black/[.08] px-4 py-1.5 text-center text-sm font-medium transition-colors hover:border-brand-600 hover:bg-brand-50 hover:text-brand-700 dark:border-white/[.145] dark:hover:border-brand-500 dark:hover:bg-brand-950 dark:hover:text-brand-400"
                >
                  {d.reschedule}
                </Link>
                <form action={cancelAppointment}>
                  <input type="hidden" name="id" value={appointment.id} />
                  <input type="hidden" name="lang" value={lang} />
                  <button
                    type="submit"
                    className="w-full rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                  >
                    {d.cancel}
                  </button>
                </form>
              </>
            )}
        </div>
      </div>
      {reviewable && (
        <ReviewForm appointmentId={appointment.id} lang={lang} dictionary={dictionary} />
      )}
    </div>
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
      "id, start_time, status, repair_stage, services(name), garages!appointments_garage_id_fkey(name, city), vehicles(model, year)"
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

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
              {d.welcomePrefix} {profile.full_name || profile.email}
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {profile.email}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href={`/${lang}/garages`}
              className="flex h-11 items-center justify-center rounded-full bg-brand-600 px-6 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {d.bookAppointment}
            </Link>
            <Link
              href={`/${lang}/vehicles`}
              className="text-sm font-medium underline"
            >
              {d.myVehicles}
            </Link>
            <Link
              href={`/${lang}/account`}
              className="text-sm font-medium underline"
            >
              {d.account}
            </Link>
          </div>
        </div>

        {booked === "1" && (
          <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
            {d.appointmentBooked}
          </p>
        )}

        {reviewError && (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {reviewError === "duplicate" ? d.reviewErrorDuplicate : d.reviewErrorGeneric}
          </p>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {d.vehicleManagement}
            </h2>
            {vehicleRows.length > 0 && (
              <Link
                href={`/${lang}/vehicles`}
                className="text-sm font-medium underline"
              >
                {d.manageVehicles}
              </Link>
            )}
          </div>
          {vehicleRows.length > 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {vehicleRows.map((vehicle) => (
                <div
                  key={vehicle.id}
                  className="flex shrink-0 flex-col gap-1 rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
                >
                  <h3 className="font-semibold text-black dark:text-zinc-50">
                    {[vehicle.brands?.name, vehicle.model]
                      .filter(Boolean)
                      .join(" ") || d.vehicleFallback}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {[vehicle.year, vehicle.license_plate]
                      .filter(Boolean)
                      .join(" · ") || d.noDetailsAdded}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyStateCard
              icon={Car}
              title={d.noVehiclesTitle}
              description={d.noVehiclesDescription}
              ctaHref={`/${lang}/vehicles`}
              ctaLabel={d.addVehicle}
            />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
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
        </div>

        {waitlistRows.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {d.waitlist}
            </h2>
            {waitlistRows.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div>
                  <h3 className="font-semibold text-black dark:text-zinc-50">
                    {entry.services?.name ?? d.serviceFallback}
                  </h3>
                  <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    {d.waitlistWith} {entry.garages?.name ?? d.garageFallback} {d.waitlistOn}{" "}
                    {dateKeyToDisplayDate(entry.date).toLocaleDateString(
                      undefined,
                      { timeZone: APP_TIME_ZONE, weekday: "short", month: "short", day: "numeric" }
                    )}
                  </p>
                  {entry.notified_at && (
                    <p className="mt-1 text-sm text-amber-600 dark:text-amber-500">
                      {d.waitlistSlotOpened}
                    </p>
                  )}
                </div>
                <form action={leaveWaitlist}>
                  <input type="hidden" name="id" value={entry.id} />
                  <input type="hidden" name="lang" value={lang} />
                  <button
                    type="submit"
                    className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                  >
                    {d.leave}
                  </button>
                </form>
              </div>
            ))}
          </div>
        )}

        {other.length > 0 && (
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {d.pastAndCancelled}
            </h2>
            {other.map((appointment) => (
              <AppointmentCard
                key={appointment.id}
                appointment={appointment}
                lang={lang}
                dictionary={dictionary}
                invoiceUrl={invoiceUrls.get(appointment.id)}
                reviewable={
                  appointment.status === "completed" &&
                  !reviewedAppointmentIds.has(appointment.id)
                }
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
