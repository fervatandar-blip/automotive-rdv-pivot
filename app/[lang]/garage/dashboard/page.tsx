import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  CircleCheckBig,
  Gauge,
  Hourglass,
  Info,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { getAuthedProfile, getGarageMembership } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { acceptMechanicInvite, declineMechanicInvite } from "@/app/actions/staff";
import {
  completeAppointment,
  confirmAppointment,
  providerCancelAppointment,
  updateRepairStage,
} from "@/app/actions/appointments";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LicensePlate } from "@/components/license-plate";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import { StyledSelect } from "@/components/styled-select";
import { REPAIR_STAGES } from "@/lib/definitions";
import { getBookableWindowsForDate } from "@/lib/availability";
import {
  agendaBadge,
  computeDayCapacity,
  formatMinutes,
  isOpenAt,
  mechanicStatus,
  parseAgendaView,
  type AgendaBadge,
  type DayCapacity,
  type MechanicStatus,
} from "@/lib/dashboard";
import {
  APP_TIME_ZONE,
  addDaysToDateKey,
  dateKeyToDisplayDate,
  dayOfWeekForDateKey,
  todayKeyInAppZone,
  zonedStartOfDay,
} from "@/lib/timezone";
import { AgendaTabs } from "./agenda-tabs";

type D = Dictionary["garageDashboard"];
type StageLabels = Dictionary["common"]["repairStage"];

// Shared by the mechanic and owner views. The vehicle embed is visible to
// garage members only for vehicles booked with this garage (vehicles RLS,
// 0036/0038); null when the appointment has no vehicle attached.
const APPOINTMENT_SELECT =
  "id, start_time, end_time, status, repair_stage, assigned_mechanic_id, services(name), profiles!appointments_client_id_fkey(full_name), walk_in:garage_customers(full_name), vehicle:vehicles(model, year, license_plate, brands(name))";

// Statuses the agenda lists: pending_payment is an unfinished checkout and
// cancelled jobs are noise on a "what's on today" view (the calendar still
// shows them).
const AGENDA_STATUSES = ["pending", "confirmed", "completed"];

// Surfaces: one card style for the whole page. Light mode mirrors the dark
// zinc palette instead of dropping it, since the app supports both themes.
const CARD =
  "rounded-xl border border-zinc-200 bg-white dark:border-zinc-800/80 dark:bg-zinc-900/50";
const CARD_INTERACTIVE = `${CARD} transition-colors hover:border-zinc-300 hover:bg-zinc-50/80 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80`;
const ACTION_BUTTON =
  "inline-flex w-full items-center justify-center rounded-full border border-zinc-200 px-3 py-1 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-black dark:border-zinc-700/80 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";

function isUpcoming(appointment: { status: string; start_time: string }) {
  return (
    (appointment.status === "pending" || appointment.status === "confirmed") &&
    new Date(appointment.start_time).getTime() >= Date.now()
  );
}

function timeFormatter(lang: Locale) {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function dayFormatter(dateLocale: string) {
  return new Intl.DateTimeFormat(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

type AgendaAppointment = {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  repair_stage: string | null;
  assigned_mechanic_id: string | null;
  services: { name: string } | null;
  profiles: { full_name: string } | null;
  // Walk-in customer (0038) when the job isn't for a registered client.
  walk_in: { full_name: string } | null;
  vehicle: {
    model: string | null;
    year: number | null;
    license_plate: string | null;
    brands: { name: string } | null;
  } | null;
};

function customerName(appointment: AgendaAppointment, d: D) {
  return (
    appointment.profiles?.full_name ?? appointment.walk_in?.full_name ?? d.clientFallback
  );
}

const BADGE_STYLES: Record<
  AgendaBadge,
  { icon: LucideIcon; className: string; labelKey: keyof D }
> = {
  awaiting_action: {
    icon: AlertCircle,
    className:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    labelKey: "badgeAwaitingAction",
  },
  confirmed: {
    icon: CheckCircle2,
    className:
      "border-green-200 bg-green-50 text-green-800 dark:border-green-500/20 dark:bg-green-500/10 dark:text-green-300",
    labelKey: "badgeConfirmed",
  },
  in_progress: {
    icon: Wrench,
    className:
      "border-brand-400/40 bg-brand-50 text-brand-700 dark:border-brand-500/25 dark:bg-brand-500/10 dark:text-brand-400",
    labelKey: "badgeInProgress",
  },
  completed: {
    icon: CircleCheckBig,
    className:
      "border-zinc-200 bg-zinc-100 text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-800/60 dark:text-zinc-400",
    labelKey: "badgeCompleted",
  },
  cancelled: {
    icon: XCircle,
    className:
      "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300",
    labelKey: "badgeCancelled",
  },
};

function StatusBadge({ badge, d }: { badge: AgendaBadge; d: D }) {
  const style = BADGE_STYLES[badge];
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${style.className}`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      {d[style.labelKey]}
    </span>
  );
}

function VehicleLine({
  vehicle,
  d,
}: {
  vehicle: NonNullable<AgendaAppointment["vehicle"]>;
  d: D;
}) {
  const description = [vehicle.brands?.name, vehicle.model, vehicle.year]
    .filter(Boolean)
    .join(" ");
  const plate = vehicle.license_plate?.trim();
  if (!plate && !description) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {plate && <LicensePlate plate={plate} label={d.plateLabel} />}
      {description && (
        <span className="text-sm text-zinc-700 dark:text-zinc-300">{description}</span>
      )}
    </div>
  );
}

function AppointmentCard({
  appointment,
  lang,
  dateLocale,
  now,
  d,
  stageLabels,
}: {
  appointment: AgendaAppointment;
  lang: Locale;
  dateLocale: string;
  now: Date;
  d: D;
  stageLabels: StageLabels;
}) {
  const isOpen = appointment.status === "pending" || appointment.status === "confirmed";
  const canConfirm = appointment.status === "pending";
  const start = new Date(appointment.start_time);

  return (
    <article
      className={`${CARD_INTERACTIVE} flex flex-col gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5`}
    >
      {/* Time rail: the thing a manager scans first. */}
      <div className="flex shrink-0 items-baseline gap-2 sm:w-20 sm:flex-col sm:items-start sm:gap-0.5">
        <p className="text-lg font-semibold tabular-nums leading-none text-black dark:text-zinc-50">
          {timeFormatter(lang).format(start)}
        </p>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {dayFormatter(dateLocale).format(start)}
        </p>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold text-black dark:text-zinc-50">
            {appointment.services?.name ?? d.serviceFallback}
          </h3>
          <StatusBadge badge={agendaBadge(appointment, now)} d={d} />
        </div>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          {d.clientLabel} {customerName(appointment, d)}
        </p>
        {appointment.vehicle && <VehicleLine vehicle={appointment.vehicle} d={d} />}
        {appointment.status === "confirmed" && (
          <form action={updateRepairStage} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="lang" value={lang} />
            <StyledSelect
              name="stage"
              defaultValue={appointment.repair_stage ?? ""}
              aria-label={d.repairStagePlaceholder}
              className="py-1.5 text-xs dark:border-zinc-700/80 dark:bg-zinc-900"
            >
              <option value="" disabled>
                {d.repairStagePlaceholder}
              </option>
              {REPAIR_STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stageLabels[stage]}
                </option>
              ))}
            </StyledSelect>
            <button type="submit" className={`${ACTION_BUTTON} w-auto shrink-0`}>
              {d.update}
            </button>
          </form>
        )}
      </div>

      {(appointment.profiles || isOpen) && (
        <div className="grid shrink-0 grid-cols-2 gap-1.5 sm:flex sm:w-28 sm:flex-col">
          {canConfirm && (
            <form action={confirmAppointment}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="inline-flex w-full items-center justify-center rounded-full bg-brand-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
              >
                {d.confirm}
              </button>
            </form>
          )}
          {appointment.profiles && (
            <Link href={`/${lang}/appointments/${appointment.id}/messages`} className={ACTION_BUTTON}>
              {d.message}
            </Link>
          )}
          {isOpen && (
            <form action={completeAppointment}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="lang" value={lang} />
              <button type="submit" className={ACTION_BUTTON}>
                {d.complete}
              </button>
            </form>
          )}
          {isOpen && (
            <Link href={`/${lang}/appointments/${appointment.id}/reschedule`} className={ACTION_BUTTON}>
              {d.reschedule}
            </Link>
          )}
          {isOpen && (
            <form action={providerCancelAppointment}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className={`${ACTION_BUTTON} text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300`}
              >
                {d.cancel}
              </button>
            </form>
          )}
        </div>
      )}
    </article>
  );
}

/** Empty calendar page with dashed "nothing here" lines; theme-aware via currentColor. */
function EmptyCalendarGraphic() {
  return (
    <svg
      aria-hidden
      viewBox="0 0 96 96"
      className="h-20 w-20 text-zinc-300 dark:text-zinc-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="14" y="20" width="68" height="62" rx="10" />
      <path d="M14 38h68" />
      <path d="M32 12v14M64 12v14" />
      <rect
        x="26"
        y="48"
        width="12"
        height="10"
        rx="2.5"
        className="text-zinc-200 dark:text-zinc-800"
        fill="currentColor"
        stroke="none"
      />
      <path d="M46 53h24M26 70h44" strokeDasharray="4 6" />
    </svg>
  );
}

function EmptyAgenda({ text, lang, d }: { text: string; lang: Locale; d: D }) {
  return (
    <div className={`${CARD} flex flex-col items-center gap-3 px-6 py-12 text-center`}>
      <EmptyCalendarGraphic />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
      <Link
        href={`/${lang}/garage/calendar`}
        className="inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400"
      >
        {d.viewFullCalendar}
        <ArrowRight aria-hidden className="h-4 w-4" />
      </Link>
    </div>
  );
}

function KpiCard({
  href,
  icon: Icon,
  label,
  value,
  hint,
  highlight = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  value: number;
  hint: string;
  // Draws attention (amber chip) when the number needs action.
  highlight?: boolean;
}) {
  return (
    <Link href={href} className={`${CARD_INTERACTIVE} group flex flex-col gap-3 p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
            highlight
              ? "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"
              : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
          }`}
        >
          <Icon aria-hidden className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <p className="text-3xl font-semibold tabular-nums tracking-tight text-black dark:text-zinc-50">
        {value}
      </p>
      <p className="text-xs text-zinc-500 group-hover:text-zinc-700 dark:text-zinc-500 dark:group-hover:text-zinc-300">
        {hint}
      </p>
    </Link>
  );
}

// Meter severity (dataviz status palette): the fill carries the state, the
// track is a lighter step of the same ramp, and the state is always spelled
// out in text too -- never color alone.
function capacityTone(percent: number) {
  if (percent >= 100) {
    return {
      stroke: "text-red-600 dark:text-red-500",
      track: "text-red-100 dark:text-red-500/15",
      labelKey: "capacityFull" as const,
    };
  }
  if (percent >= 80) {
    return {
      stroke: "text-amber-500",
      track: "text-amber-100 dark:text-amber-500/15",
      labelKey: "capacityNearlyFull" as const,
    };
  }
  return {
    stroke: "text-brand-600 dark:text-brand-500",
    track: "text-brand-50 dark:text-brand-500/15",
    labelKey: "capacityAvailable" as const,
  };
}

const RING_RADIUS = 26;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function CapacityRing({
  percent,
  label,
  valueText,
}: {
  percent: number | null;
  label: string;
  valueText: string;
}) {
  const tone = capacityTone(percent ?? 0);
  return (
    <div
      role="meter"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent ?? 0}
      aria-valuetext={valueText}
      className="relative h-16 w-16 shrink-0"
    >
      <svg viewBox="0 0 64 64" className="h-16 w-16 -rotate-90" aria-hidden>
        <circle
          cx="32"
          cy="32"
          r={RING_RADIUS}
          fill="none"
          stroke="currentColor"
          strokeWidth="7"
          className={percent === null ? "text-zinc-200 dark:text-zinc-800" : tone.track}
        />
        {percent !== null && percent > 0 && (
          <circle
            cx="32"
            cy="32"
            r={RING_RADIUS}
            fill="none"
            stroke="currentColor"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={`${(percent / 100) * RING_CIRCUMFERENCE} ${RING_CIRCUMFERENCE}`}
            className={tone.stroke}
          />
        )}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-sm font-semibold tabular-nums text-black dark:text-zinc-50">
        {percent === null ? "—" : `${percent}%`}
      </span>
    </div>
  );
}

function CapacityKpi({ capacity, lang, d }: { capacity: DayCapacity; lang: Locale; d: D }) {
  const open = capacity.kind === "open" ? capacity : null;
  const bookedText = open
    ? d.capacityBooked
        .replace("{booked}", formatMinutes(open.bookedMinutes))
        .replace("{capacity}", formatMinutes(open.capacityMinutes))
    : null;
  const stateText = open
    ? d[capacityTone(open.percent).labelKey]
    : capacity.kind === "closed"
      ? d.capacityClosed
      : d.capacityNoMechanics;

  return (
    <Link
      href={`/${lang}/garage/${capacity.kind === "no_mechanics" ? "staff" : "availability"}`}
      className={`${CARD_INTERACTIVE} group flex flex-col gap-3 p-4 sm:p-5`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{d.capacityTitle}</p>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
          <Gauge aria-hidden className="h-4 w-4" strokeWidth={2} />
        </span>
      </div>
      <div className="flex items-center gap-3">
        <CapacityRing
          percent={open ? open.percent : null}
          label={d.capacityTitle}
          valueText={open ? `${open.percent}% · ${bookedText}` : stateText}
        />
        <div className="min-w-0">
          <p className="text-sm font-medium text-black dark:text-zinc-50">{stateText}</p>
          {bookedText && (
            <p className="text-xs tabular-nums text-zinc-500 dark:text-zinc-400">{bookedText}</p>
          )}
        </div>
      </div>
    </Link>
  );
}

function Callout({
  tone,
  icon: Icon,
  title,
  description,
  children,
}: {
  tone: "amber" | "red";
  icon: LucideIcon;
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  const toneClass =
    tone === "amber"
      ? "border-amber-300/60 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200"
      : "border-red-300/60 bg-red-50 text-red-900 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200";
  return (
    <div
      className={`flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${toneClass}`}
    >
      <div className="flex min-w-0 items-start gap-3">
        <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
        <div className="min-w-0">
          <p className="text-sm font-medium">{title}</p>
          <p className="text-sm opacity-80">{description}</p>
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">{children}</div>}
    </div>
  );
}

const CALLOUT_BUTTON =
  "rounded-full bg-amber-900 px-3.5 py-1.5 text-sm font-medium text-amber-50 transition-colors hover:bg-amber-800 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200";

type Mechanic = { id: string; name: string };

const TEAM_DOT: Record<MechanicStatus["kind"], string> = {
  busy: "bg-brand-600 dark:bg-brand-500",
  free: "bg-green-600 dark:bg-green-500",
  off: "bg-zinc-400 dark:bg-zinc-600",
};

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

function teamStatusText(status: MechanicStatus, d: D, formatTime: (iso: string) => string) {
  if (status.kind === "busy") return d.teamBusyUntil.replace("{time}", formatTime(status.until));
  if (status.kind === "free") {
    return status.nextAt ? d.teamFreeNext.replace("{time}", formatTime(status.nextAt)) : d.teamFree;
  }
  return status.nextAt ? d.teamOffNext.replace("{time}", formatTime(status.nextAt)) : d.teamOff;
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

// Outcomes of accept/decline (app/actions/staff.ts) shown on the no-garage
// empty state. "accepted" never lands here -- it shows the garage instead.
const INVITE_RESULT_KEYS = {
  declined: "inviteDeclined",
  not_found: "inviteNotFound",
  not_mechanic: "inviteNotMechanic",
  already_staff: "inviteAlreadyStaff",
  error: "inviteError",
} as const;

type PendingInvite = {
  id: string;
  garage_name: string;
  expires_at: string;
};

export default async function GarageDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ invite?: string; view?: string }>;
}) {
  const { lang: rawLang } = await params;
  const { invite: inviteResult, view } = await searchParams;
  const lang = resolveLocale(rawLang);
  const profile = await getAuthedProfile(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageDashboard;
  const stageLabels = dictionary.common.repairStage;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const now = new Date();

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
    // A mecanicien with no garage association: newly invited (pending
    // invites listed below) or removed from staff. Don't call
    // requireGarageMember here -- its fallback redirects to
    // /garage/dashboard, which would loop forever on this exact page.
    const supabase = await createClient();
    const { data: invitesData } = await supabase.rpc("list_my_garage_invites");
    const pendingInvites = (invitesData ?? []) as PendingInvite[];
    const resultKey =
      inviteResult && inviteResult in INVITE_RESULT_KEYS
        ? INVITE_RESULT_KEYS[inviteResult as keyof typeof INVITE_RESULT_KEYS]
        : null;

    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-16 dark:bg-black">
        <div className="flex w-full max-w-md flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {pendingInvites.length > 0 ? d.invitesTitle : d.noGarageTitle}
          </h1>
          {resultKey && (
            <p
              role="status"
              className="rounded-md bg-zinc-100 px-3 py-2 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
            >
              {d[resultKey]}
            </p>
          )}
          {pendingInvites.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.invitesDescription}</p>
              {pendingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 rounded-lg border border-black/[.08] p-4 dark:border-white/[.145]"
                >
                  <div>
                    <p className="font-medium text-black dark:text-zinc-50">{invite.garage_name}</p>
                    <p className="text-xs text-zinc-500">
                      {d.inviteExpires.replace(
                        "{date}",
                        new Date(invite.expires_at).toLocaleDateString(dateLocale, {
                          timeZone: APP_TIME_ZONE,
                          day: "numeric",
                          month: "long",
                        })
                      )}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <form action={acceptMechanicInvite}>
                      <input type="hidden" name="lang" value={lang} />
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button
                        type="submit"
                        className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
                      >
                        {d.acceptInvite}
                      </button>
                    </form>
                    <form action={declineMechanicInvite}>
                      <input type="hidden" name="lang" value={lang} />
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button
                        type="submit"
                        className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
                      >
                        {d.declineInvite}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.noGarageDescription}</p>
          )}
          <Link href={`/${lang}/account`} className="text-sm font-medium underline">
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

  const todayKey = todayKeyInAppZone(now);
  const todayLabel = dateKeyToDisplayDate(todayKey).toLocaleDateString(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const pageHeader = (
    <header className="flex flex-col gap-1">
      <p className="text-sm font-medium capitalize text-zinc-500 dark:text-zinc-400">{todayLabel}</p>
      <h1 className="text-2xl font-semibold tracking-tight text-black dark:text-zinc-50 sm:text-3xl">
        {d.title}
      </h1>
    </header>
  );

  if (!isOwner) {
    const supabase = await createClient();
    const { data: appointments } = await supabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("garage_id", garage.id)
      .eq("assigned_mechanic_id", profile.id)
      .order("start_time", { ascending: true });

    const rows = (appointments ?? []) as unknown as AgendaAppointment[];
    const upcoming = rows.filter(isUpcoming);
    const other = rows.filter((appointment) => !upcoming.includes(appointment));

    return (
      <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          {pageHeader}
          <section className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
              {d.yourAssignedAppointments}
            </h2>
            {upcoming.length > 0 ? (
              upcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  lang={lang}
                  dateLocale={dateLocale}
                  now={now}
                  d={d}
                  stageLabels={stageLabels}
                />
              ))
            ) : (
              <EmptyAgenda text={d.noUpcomingAssigned} lang={lang} d={d} />
            )}
          </section>

          {other.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
                {d.pastAndCancelled}
              </h2>
              {other.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  lang={lang}
                  dateLocale={dateLocale}
                  now={now}
                  d={d}
                  stageLabels={stageLabels}
                />
              ))}
            </section>
          )}
        </div>
      </div>
    );
  }

  const ownerSupabase = await createClient();
  const nowIso = now.toISOString();

  // Day and week boundaries in the garage's zone, not the server's (UTC on
  // Vercel). "This week" runs from today to the end of Sunday: earlier days
  // of the week are history, which the calendar already covers.
  const todayStart = zonedStartOfDay(todayKey);
  const tomorrowStart = zonedStartOfDay(addDaysToDateKey(todayKey, 1));
  const diffToMonday = (dayOfWeekForDateKey(todayKey) + 6) % 7;
  const mondayKey = addDaysToDateKey(todayKey, -diffToMonday);
  const startOfWeek = zonedStartOfDay(mondayKey);
  const endOfWeek = zonedStartOfDay(addDaysToDateKey(mondayKey, 7));

  const [
    { count: upcomingCount },
    { count: pendingCount },
    { count: completedThisWeekCount },
    { data: weekData },
    { data: todayLoad },
    { windows },
    { data: mechanicCountData },
    { data: staffData },
  ] = await Promise.all([
    ownerSupabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("garage_id", garage.id)
      .in("status", ["pending", "confirmed"])
      .gte("start_time", nowIso),
    // Bookings are confirmed on creation now (0040); this only finds paid
    // bookings from before the pilot that still await the garage's OK.
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
    // Today + This week tabs: one query, split below.
    ownerSupabase
      .from("appointments")
      .select(APPOINTMENT_SELECT)
      .eq("garage_id", garage.id)
      .in("status", AGENDA_STATUSES)
      .gte("start_time", todayStart.toISOString())
      .lt("start_time", endOfWeek.toISOString())
      .order("start_time", { ascending: true })
      .limit(300),
    // Capacity: everything holding a mechanic today, including unfinished
    // checkouts (pending_payment holds the slot) and jobs that started
    // yesterday but run into today.
    ownerSupabase
      .from("appointments")
      .select("start_time, end_time")
      .eq("garage_id", garage.id)
      .neq("status", "cancelled")
      .lt("start_time", tomorrowStart.toISOString())
      .gt("end_time", todayStart.toISOString()),
    // Opening hours minus intraday blocks (0039): blocked time isn't
    // capacity, and it shows as a gap in "Opening hours".
    getBookableWindowsForDate({
      supabase: ownerSupabase,
      garageId: garage.id,
      date: todayKey,
    }),
    ownerSupabase.rpc("get_bookable_mechanic_count", {
      target_garage_id: garage.id,
    }) as unknown as Promise<{ data: number | null }>,
    ownerSupabase.from("garage_staff").select("profiles(id, full_name)").eq("garage_id", garage.id),
  ]);

  const weekAppointments = (weekData ?? []) as unknown as AgendaAppointment[];
  const todayAppointments = weekAppointments.filter(
    (appointment) => new Date(appointment.start_time).getTime() < tomorrowStart.getTime()
  );
  const mechanicCount = mechanicCountData ?? 0;
  const capacity = computeDayCapacity({
    date: todayKey,
    windows,
    mechanicCount,
    bookings: todayLoad ?? [],
  });

  // Team: the bookable mechanics (0037) -- the owner unless they opted
  // out, plus accepted staff.
  const staff = (staffData ?? [])
    .map((row) => row.profiles as unknown as { id: string; full_name: string } | null)
    .filter((person): person is { id: string; full_name: string } => person !== null);
  const mechanics: Mechanic[] = [
    ...(garage.owner_takes_bookings ? [{ id: profile.id, name: profile.full_name as string }] : []),
    ...staff.map((person) => ({ id: person.id, name: person.full_name })),
  ];
  const shopOpen = isOpenAt({ date: todayKey, windows, now });
  const formatTime = (iso: string) => timeFormatter(lang).format(new Date(iso));

  const openToday = todayAppointments.filter(
    (appointment) => appointment.status === "pending" || appointment.status === "confirmed"
  );
  const completedToday = todayAppointments.filter(
    (appointment) => appointment.status === "completed"
  );
  const nextUp = openToday.find(
    (appointment) => new Date(appointment.start_time).getTime() > now.getTime()
  );
  const hoursText =
    windows.length > 0
      ? windows
          .map((window) => `${window.start_time.slice(0, 5)}–${window.end_time.slice(0, 5)}`)
          .join(" · ")
      : d.glanceClosed;

  function renderList(list: AgendaAppointment[], emptyText: string) {
    if (list.length === 0) {
      return <EmptyAgenda text={emptyText} lang={lang} d={d} />;
    }
    return list.map((appointment) => (
      <AppointmentCard
        key={appointment.id}
        appointment={appointment}
        lang={lang}
        dateLocale={dateLocale}
        now={now}
        d={d}
        stageLabels={stageLabels}
      />
    ));
  }

  const initialView = parseAgendaView(view);
  const legacyPending = pendingCount ?? 0;

  return (
    <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6">
        {pageHeader}

        {(garage.status !== "approved" || legacyPending > 0) && (
          <div className="flex flex-col gap-3">
            {garage.status !== "approved" && (
              <Callout
                tone={garage.status === "rejected" ? "red" : "amber"}
                icon={Info}
                title={garage.status === "rejected" ? d.garageRejectedTitle : d.garagePendingTitle}
                description={
                  garage.status === "rejected"
                    ? d.garageRejectedDescription
                    : d.garagePendingDescription
                }
              >
                <Link href={`/${lang}/garage/profile`} className={CALLOUT_BUTTON}>
                  {d.reviewProfile}
                </Link>
              </Callout>
            )}
            {legacyPending > 0 && (
              <Callout
                tone="amber"
                icon={Hourglass}
                title={d.legacyPendingTitle.replace("{count}", String(legacyPending))}
                description={d.legacyPendingDescription}
              >
                <Link href={`/${lang}/garage/calendar`} className={CALLOUT_BUTTON}>
                  {d.legacyPendingAction}
                </Link>
              </Callout>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <KpiCard
            href={`/${lang}/garage/calendar`}
            icon={CalendarClock}
            label={d.statUpcoming}
            value={upcomingCount ?? 0}
            hint={d.kpiUpcomingHint}
          />
          <KpiCard
            href={`/${lang}/garage/dashboard?view=today`}
            icon={CalendarCheck}
            label={d.statToday}
            value={todayAppointments.length}
            hint={d.kpiTodayHint.replace("{count}", String(openToday.length))}
          />
          <KpiCard
            href={`/${lang}/garage/calendar`}
            icon={CircleCheckBig}
            label={d.statCompletedThisWeek}
            value={completedThisWeekCount ?? 0}
            hint={d.kpiCompletedHint}
          />
          <CapacityKpi capacity={capacity} lang={lang} d={d} />
        </div>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <section aria-labelledby="agenda-title" className="flex min-w-0 flex-col gap-4">
            <h2 id="agenda-title" className="text-lg font-semibold text-black dark:text-zinc-50">
              {d.agendaTitle}
            </h2>
            <AgendaTabs
              key={initialView}
              label={d.agendaTabsLabel}
              initialView={initialView}
              trailing={
                <Link
                  href={`/${lang}/garage/calendar`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {d.viewFullCalendar}
                  <ArrowRight aria-hidden className="h-4 w-4" />
                </Link>
              }
              tabs={[
                {
                  id: "today",
                  label: d.tabToday,
                  count: todayAppointments.length,
                  panel: renderList(todayAppointments, d.emptyToday),
                },
                {
                  id: "week",
                  label: d.tabWeek,
                  count: weekAppointments.length,
                  panel: renderList(weekAppointments, d.emptyWeek),
                },
              ]}
            />
          </section>

          <aside className="flex flex-col gap-4">
            <section aria-labelledby="glance-title" className={`${CARD} p-5`}>
              <h2 id="glance-title" className="text-sm font-semibold text-black dark:text-zinc-50">
                {d.glanceTitle}
              </h2>
              <dl className="mt-4 flex flex-col gap-3 text-sm">
                <div className="flex items-start justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400">{d.glanceHours}</dt>
                  <dd className="text-right font-medium tabular-nums text-black dark:text-zinc-50">
                    {hoursText}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400">{d.glanceRemaining}</dt>
                  <dd className="font-medium tabular-nums text-black dark:text-zinc-50">
                    {openToday.length}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <dt className="text-zinc-500 dark:text-zinc-400">{d.glanceDone}</dt>
                  <dd className="font-medium tabular-nums text-black dark:text-zinc-50">
                    {completedToday.length}
                  </dd>
                </div>
                <div className="flex flex-col gap-1 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                  <dt className="text-zinc-500 dark:text-zinc-400">{d.glanceNextUp}</dt>
                  <dd className="text-black dark:text-zinc-50">
                    {nextUp ? (
                      <>
                        <span className="font-semibold tabular-nums">
                          {formatTime(nextUp.start_time)}
                        </span>{" "}
                        · {nextUp.services?.name ?? d.serviceFallback}
                        <span className="block truncate text-zinc-500 dark:text-zinc-400">
                          {customerName(nextUp, d)}
                        </span>
                      </>
                    ) : (
                      <span className="text-zinc-500 dark:text-zinc-400">{d.glanceNothingNext}</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>

            <section aria-labelledby="team-title" className={`${CARD} p-5`}>
              <div className="flex items-center justify-between gap-2">
                <h2 id="team-title" className="text-sm font-semibold text-black dark:text-zinc-50">
                  {d.teamTitle}
                </h2>
                <Link
                  href={`/${lang}/garage/staff`}
                  className="text-xs font-medium text-zinc-500 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
                >
                  {d.teamManage}
                </Link>
              </div>
              {mechanics.length === 0 ? (
                <p className="mt-4 text-sm text-zinc-500 dark:text-zinc-400">{d.teamEmpty}</p>
              ) : (
                <ul className="mt-4 flex flex-col gap-3">
                  {mechanics.map((mechanic) => {
                    const status = mechanicStatus({
                      mechanicId: mechanic.id,
                      appointments: todayAppointments,
                      now,
                      shopOpen,
                    });
                    return (
                      <li key={mechanic.id} className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          {initials(mechanic.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-black dark:text-zinc-50">
                            {mechanic.name}
                            {mechanic.id === profile.id && (
                              <span className="font-normal text-zinc-500 dark:text-zinc-400">
                                {" "}
                                ({d.teamYou})
                              </span>
                            )}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                            <span
                              aria-hidden
                              className={`h-1.5 w-1.5 shrink-0 rounded-full ${TEAM_DOT[status.kind]}`}
                            />
                            {teamStatusText(status, d, formatTime)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="mt-4 text-xs text-zinc-400 dark:text-zinc-500">{d.teamNote}</p>
            </section>

            <PushNotificationOptIn />
          </aside>
        </div>
      </div>
    </div>
  );
}
