import Link from "next/link";
import { redirect } from "next/navigation";
import { getAuthedProfile, getGarageMembership } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import {
  completeAppointment,
  confirmAppointment,
  providerCancelAppointment,
  updateRepairStage,
} from "@/app/actions/appointments";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import { StyledSelect } from "@/components/styled-select";
import { REPAIR_STAGES, REPAIR_STAGE_LABELS } from "@/lib/definitions";
import {
  APP_TIME_ZONE,
  addDaysToDateKey,
  dayOfWeekForDateKey,
  todayKeyInAppZone,
  zonedStartOfDay,
} from "@/lib/timezone";

type D = Dictionary["garageDashboard"];

function isUpcoming(appointment: { status: string; start_time: string }) {
  return (
    (appointment.status === "pending" || appointment.status === "confirmed") &&
    new Date(appointment.start_time).getTime() >= Date.now()
  );
}

function formatDateTime(iso: string, dateLocale: string) {
  return new Date(iso).toLocaleString(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

type AssignedAppointment = {
  id: string;
  start_time: string;
  status: string;
  repair_stage: string | null;
  services: { name: string } | null;
  profiles: { full_name: string } | null;
};

function MechanicAppointmentCard({
  appointment,
  lang,
  dateLocale,
  d,
}: {
  appointment: AssignedAppointment;
  lang: Locale;
  dateLocale: string;
  d: D;
}) {
  const canConfirm = appointment.status === "pending";
  const canComplete =
    appointment.status === "pending" || appointment.status === "confirmed";
  const canCancel =
    appointment.status === "pending" || appointment.status === "confirmed";
  const canReschedule = canCancel;

  return (
    <div className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
      <div>
        <h3 className="font-semibold text-black dark:text-zinc-50">
          {appointment.services?.name ?? d.serviceFallback}
        </h3>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {d.clientLabel} {appointment.profiles?.full_name ?? d.clientFallback}
        </p>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {formatDateTime(appointment.start_time, dateLocale)}
        </p>
        {appointment.status === "cancelled" && (
          <p className="mt-1 text-sm text-red-600">{d.cancelled}</p>
        )}
        {appointment.status === "completed" && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {d.completed}
          </p>
        )}
        {appointment.status === "confirmed" && (
          <form
            action={updateRepairStage}
            className="mt-2 flex items-center gap-2"
          >
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="lang" value={lang} />
            <StyledSelect
              name="stage"
              defaultValue={appointment.repair_stage ?? ""}
              className="text-xs"
            >
              <option value="" disabled>
                {d.repairStagePlaceholder}
              </option>
              {REPAIR_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {REPAIR_STAGE_LABELS[stage]}
                </option>
              ))}
            </StyledSelect>
            <button
              type="submit"
              className="shrink-0 rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              {d.update}
            </button>
          </form>
        )}
      </div>
      <div className="flex shrink-0 flex-col gap-1.5">
        <Link
          href={`/${lang}/appointments/${appointment.id}/messages`}
          className="w-full rounded-full border border-black/[.08] px-4 py-1 text-center text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          {d.message}
        </Link>
        {canConfirm && (
          <form action={confirmAppointment}>
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="lang" value={lang} />
            <button
              type="submit"
              className="w-full rounded-full border border-black/[.08] px-4 py-1 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              {d.confirm}
            </button>
          </form>
        )}
        {canComplete && (
          <form action={completeAppointment}>
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="lang" value={lang} />
            <button
              type="submit"
              className="w-full rounded-full border border-black/[.08] px-4 py-1 text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              {d.complete}
            </button>
          </form>
        )}
        {canReschedule && (
          <Link
            href={`/${lang}/appointments/${appointment.id}/reschedule`}
            className="w-full rounded-full border border-black/[.08] px-4 py-1 text-center text-xs font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            {d.reschedule}
          </Link>
        )}
        {canCancel && (
          <form action={providerCancelAppointment}>
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="lang" value={lang} />
            <button
              type="submit"
              className="w-full rounded-full border border-black/[.08] px-4 py-1 text-xs font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              {d.cancel}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

function OwnerStatTile({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950">
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
        {value}
      </p>
    </div>
  );
}

function LogoutButton({ lang, d }: { lang: Locale; d: D }) {
  return (
    <form action={logout}>
      <input type="hidden" name="lang" value={lang} />
      <button
        type="submit"
        className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
      >
        {d.logOut}
      </button>
    </form>
  );
}

export default async function GarageDashboardPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const profile = await getAuthedProfile(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageDashboard;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";

  // Direct navigation guard -- getGarageMembership alone can't tell "wrong
  // role" apart from "right role, no garage association" (both return
  // null), and this page's own empty state below is specific to the
  // latter. A client/super_admin hitting this URL directly belongs back on
  // their own dashboard, not this garage-specific empty state.
  if (profile.role !== "admin_garage" && profile.role !== "mecanicien") {
    redirect(`/${lang}/dashboard`);
  }

  const membership = await getGarageMembership(lang);

  if (!membership) {
    // A mecanicien with no garage association (e.g. removed from staff).
    // Don't call requireGarageMember here -- its fallback redirects to
    // /garage/dashboard, which would loop forever on this exact page.
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-16 dark:bg-black">
        <div className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {d.noGarageTitle}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {d.noGarageDescription}
          </p>
          <Link
            href={`/${lang}/account`}
            className="text-sm font-medium underline"
          >
            {d.account}
          </Link>
          <LanguageSwitcher lang={lang} />
          <LogoutButton lang={lang} d={d} />
        </div>
      </div>
    );
  }

  const { garage, isOwner } = membership;

  if (isOwner && !garage.platform_terms_accepted_at) {
    redirect(`/${lang}/garage/onboarding`);
  }

  if (!isOwner) {
    const supabase = await createClient();
    const { data: appointments } = await supabase
      .from("appointments")
      .select(
        "id, start_time, status, repair_stage, services(name), profiles!appointments_client_id_fkey(full_name)"
      )
      .eq("garage_id", garage.id)
      .eq("assigned_mechanic_id", profile.id)
      .order("start_time", { ascending: true });

    const rows = (appointments ?? []) as unknown as AssignedAppointment[];
    const upcoming = rows.filter(isUpcoming);
    const other = rows.filter(
      (appointment) => !upcoming.includes(appointment)
    );

    return (
      <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {d.yourAssignedAppointments}
            </h2>
            {upcoming.length > 0 ? (
              upcoming.map((appointment) => (
                <MechanicAppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  lang={lang}
                  dateLocale={dateLocale}
                  d={d}
                />
              ))
            ) : (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {d.noUpcomingAssigned}
              </p>
            )}
          </div>

          {other.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {d.pastAndCancelled}
              </h2>
              {other.map((appointment) => (
                <MechanicAppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  lang={lang}
                  dateLocale={dateLocale}
                  d={d}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  const ownerSupabase = await createClient();
  const nowIso = new Date().toISOString();

  // Monday 00:00 in the garage's zone, not the server's (UTC on Vercel).
  const todayKey = todayKeyInAppZone();
  const diffToMonday = (dayOfWeekForDateKey(todayKey) + 6) % 7;
  const startOfWeek = zonedStartOfDay(addDaysToDateKey(todayKey, -diffToMonday));

  const [
    { count: upcomingCount },
    { count: pendingCount },
    { count: completedThisWeekCount },
    { data: ownerAppointments },
  ] = await Promise.all([
    ownerSupabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("garage_id", garage.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_time", nowIso),
    ownerSupabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("garage_id", garage.id)
      .eq("status", "pending"),
    ownerSupabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("garage_id", garage.id)
      .eq("status", "completed")
      .gte("start_time", startOfWeek.toISOString()),
    ownerSupabase
      .from("appointments")
      .select(
        "id, start_time, status, repair_stage, services(name), profiles!appointments_client_id_fkey(full_name)"
      )
      .eq("garage_id", garage.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_time", nowIso)
      .order("start_time", { ascending: true })
      .limit(5),
  ]);

  const ownerUpcoming = (ownerAppointments ?? []) as unknown as AssignedAppointment[];

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <OwnerStatTile label={d.statUpcoming} value={upcomingCount ?? 0} />
          <OwnerStatTile
            label={d.statAwaitingConfirmation}
            value={pendingCount ?? 0}
          />
          <OwnerStatTile
            label={d.statCompletedThisWeek}
            value={completedThisWeekCount ?? 0}
          />
        </div>

        {garage.status !== "approved" && (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-300">
                {garage.status === "rejected"
                  ? d.garageRejectedTitle
                  : d.garagePendingTitle}
              </h3>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-400">
                {garage.status === "pending"
                  ? d.garagePendingDescription
                  : d.garageRejectedDescription}
              </p>
            </div>
            <Link
              href={`/${lang}/garage/onboarding`}
              className="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {d.reviewProfile}
            </Link>
          </div>
        )}

        {!garage.stripe_charges_enabled && (
          <div className="flex flex-col items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900 dark:bg-amber-950 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="font-semibold text-amber-900 dark:text-amber-300">
                {d.connectStripeTitle}
              </h3>
              <p className="mt-1 text-sm text-amber-800 dark:text-amber-400">
                {d.connectStripeDescription}
              </p>
            </div>
            <Link
              href={`/${lang}/garage/stripe-connect`}
              className="shrink-0 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
            >
              {d.setUpPayments}
            </Link>
          </div>
        )}

        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {d.upcomingAppointments}
            </h2>
            <Link
              href={`/${lang}/garage/calendar`}
              className="text-sm font-medium underline"
            >
              {d.viewFullCalendar} &rarr;
            </Link>
          </div>
          {ownerUpcoming.length > 0 ? (
            ownerUpcoming.map((appointment) => (
              <MechanicAppointmentCard
                key={appointment.id}
                appointment={appointment}
                lang={lang}
                dateLocale={dateLocale}
                d={d}
              />
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {d.noUpcomingAppointments}
            </p>
          )}
        </div>

        <PushNotificationOptIn />
      </div>
    </div>
  );
}
