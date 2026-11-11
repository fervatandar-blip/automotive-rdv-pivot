import Link from "next/link";
import { redirect } from "next/navigation";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  Check,
  CheckCircle2,
  CircleCheckBig,
  Gauge,
  Hourglass,
  Info,
  KeyRound,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { getAuthedProfile, getGarageMembership } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { acceptMechanicInvite, declineMechanicInvite } from "@/app/actions/staff";
import { completeAppointment, confirmAppointment } from "@/app/actions/appointments";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LicensePlate } from "@/components/license-plate";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import { QuickWalkInButton } from "@/components/quick-walk-in-modal";
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
import { AppointmentActionsMenu } from "./appointment-actions-menu";
import { MobileCollapsible } from "./mobile-collapsible";

type D = Dictionary["garageDashboard"];
type StageLabels = Dictionary["common"]["repairStage"];

// Shared by the mechanic and owner views. The vehicle embed is visible to
// garage members only for vehicles booked with this garage (vehicles RLS,
// 0036/0038); null when the appointment has no vehicle attached.
const APPOINTMENT_SELECT =
  "id, client_id, start_time, end_time, status, repair_stage, assigned_mechanic_id, services(name), profiles!appointments_client_id_fkey(full_name, phone), walk_in:garage_customers(full_name, phone), vehicle:vehicles(model, year, license_plate, brands(name))";

// Statuses the agenda lists: pending_payment is an unfinished checkout and
// cancelled jobs are noise on a "what's on today" view (the calendar still
// shows them).
const AGENDA_STATUSES = ["pending", "confirmed", "completed"];

// Surfaces: one quiet style for the whole page -- a single hairline border,
// no fill in dark mode, never a box inside a box. Light mode keeps a white
// fill so cards lift off the zinc-50 page.
const CARD =
  "rounded-xl border border-zinc-200/80 bg-white dark:border-zinc-800/60 dark:bg-transparent";
const CARD_INTERACTIVE = `${CARD} transition-colors hover:border-zinc-300 dark:hover:border-zinc-700/80 dark:hover:bg-zinc-900/40`;
// KPI strip: a swipeable row on phones (the next card peeks in so the row
// reads as scrollable), a 2x2 grid from sm, one row of four from lg.
const KPI_ITEM = "w-[72%] max-w-[17rem] shrink-0 snap-start sm:w-auto sm:max-w-none";
const SECTION_LABEL =
  "text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400";

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
  profiles: { full_name: string; phone: string | null } | null;
  // Walk-in customer (0038) when the job isn't for a registered client.
  walk_in: { full_name: string; phone: string | null } | null;
  client_id: string | null;
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
    className: "text-amber-700 dark:text-amber-300",
    labelKey: "badgeAwaitingAction",
  },
  confirmed: {
    icon: CheckCircle2,
    className: "text-zinc-600 dark:text-zinc-400",
    labelKey: "badgeConfirmed",
  },
  in_progress: {
    icon: Wrench,
    className: "text-brand-700 dark:text-brand-400",
    labelKey: "badgeInProgress",
  },
  completed: {
    icon: CircleCheckBig,
    className: "text-green-700 dark:text-green-400",
    labelKey: "badgeCompleted",
  },
  cancelled: {
    icon: XCircle,
    className: "text-red-700 dark:text-red-400",
    labelKey: "badgeCancelled",
  },
};

// Borderless status: icon + text in the state's color. The row already has
// a frame; a bordered pill here would be the box-in-a-box we're removing.
function StatusBadge({ badge, d }: { badge: AgendaBadge; d: D }) {
  const style = BADGE_STYLES[badge];
  const Icon = style.icon;
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1 whitespace-nowrap text-xs font-medium ${style.className}`}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
      {d[style.labelKey]}
    </span>
  );
}

const PRIMARY_BUTTON =
  "inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-semibold text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1 dark:focus-visible:ring-offset-zinc-950";

/**
 * One agenda row. Phones stack it: time + status (and the "⋯") on top, then
 * customer and phone, car and plate, the service order, and the primary
 * action full-width at the bottom. From md it's one line: time, details,
 * status, primary action, "⋯" -- the wrappers switch to `display: contents`
 * so their children become items of the row and `order` places them.
 * Nothing that identifies the job (name, phone, plate) is truncated.
 */
function AppointmentRow({
  appointment,
  phone,
  lang,
  dateLocale,
  now,
  d,
  stageLabels,
  showDay,
}: {
  appointment: AgendaAppointment;
  // Walk-in's phone, or the one the garage noted for a registered client.
  phone: string | null;
  lang: Locale;
  dateLocale: string;
  now: Date;
  d: D;
  stageLabels: StageLabels;
  // Week / mechanic lists span several days; Today doesn't need the date.
  showDay: boolean;
}) {
  const isPending = appointment.status === "pending";
  const isConfirmed = appointment.status === "confirmed";
  const isOpen = isPending || isConfirmed;
  const start = new Date(appointment.start_time);
  const vehicle = appointment.vehicle;
  const plate = vehicle?.license_plate?.trim();
  const vehicleText = vehicle
    ? [vehicle.brands?.name, vehicle.model, vehicle.year].filter(Boolean).join(" ")
    : "";
  const stage =
    isConfirmed && appointment.repair_stage
      ? stageLabels[appointment.repair_stage as keyof StageLabels]
      : null;
  const serviceLine = [appointment.services?.name ?? d.serviceFallback, stage]
    .filter(Boolean)
    .join(" · ");

  return (
    <li className="flex flex-col gap-2.5 px-4 py-3.5 transition-colors hover:bg-zinc-50/70 sm:px-5 md:flex-row md:items-center md:gap-4 dark:hover:bg-zinc-900/40">
      <div className="flex items-center justify-between gap-3 md:contents">
        <div className="flex items-center gap-2 md:order-1 md:w-16 md:shrink-0 md:flex-col md:items-start md:gap-0.5">
          <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-sm font-semibold tabular-nums text-black dark:bg-zinc-800/70 dark:text-zinc-50">
            {timeFormatter(lang).format(start)}
          </span>
          {showDay && (
            <span className="whitespace-nowrap text-xs text-zinc-500 md:text-[11px]">
              {dayFormatter(dateLocale).format(start)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 md:contents">
          <div className="md:order-3 md:ml-auto">
            <StatusBadge badge={agendaBadge(appointment, now)} d={d} />
          </div>
          <div className="md:order-5">
            <AppointmentActionsMenu
              appointmentId={appointment.id}
              lang={lang}
              labels={{
                moreActions: d.moreActions,
                message: d.message,
                reschedule: d.reschedule,
                complete: d.complete,
                stageHeading: d.stageHeading,
                cancelAppointment: d.cancelAppointment,
                cancelConfirm: d.cancelConfirm,
                cancelConfirmYes: d.cancelConfirmYes,
                cancelKeep: d.cancelKeep,
              }}
              canMessage={appointment.profiles !== null}
              isOpen={isOpen}
              showComplete={isPending}
              stages={
                isConfirmed
                  ? REPAIR_STAGES.map((value) => ({ value, label: stageLabels[value] }))
                  : null
              }
              currentStage={appointment.repair_stage}
            />
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1 md:order-2 md:flex-1 md:gap-0.5">
        <p className="flex flex-wrap items-baseline gap-x-2 break-words">
          <span className="font-medium text-black dark:text-zinc-50">
            {customerName(appointment, d)}
          </span>
          {phone && (
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              className="text-sm tabular-nums text-zinc-500 hover:text-black hover:underline dark:text-zinc-400 dark:hover:text-zinc-100"
            >
              {phone}
            </a>
          )}
        </p>
        {(plate || vehicleText) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {plate && <LicensePlate plate={plate} label={d.plateLabel} />}
            {vehicleText && <span>{vehicleText}</span>}
          </p>
        )}
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{serviceLine}</p>
      </div>

      {(isPending || isConfirmed) && (
        <form action={isPending ? confirmAppointment : completeAppointment} className="md:order-4">
          <input type="hidden" name="id" value={appointment.id} />
          <input type="hidden" name="lang" value={lang} />
          <button
            type="submit"
            className={`${PRIMARY_BUTTON} w-full justify-center py-2 md:w-auto md:py-1.5 ${
              isPending
                ? "bg-brand-600 hover:bg-brand-700 focus-visible:ring-brand-600/50 dark:bg-brand-500 dark:hover:bg-brand-600"
                : "bg-green-600 hover:bg-green-700 focus-visible:ring-green-600/50 dark:bg-green-600 dark:hover:bg-green-500"
            }`}
          >
            {isConfirmed && <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.5} />}
            {isPending ? d.confirm : d.complete}
          </button>
        </form>
      )}
    </li>
  );
}

/** The agenda's single frame: rows divided by hairlines, no per-row boxes. */
function AppointmentList({ children }: { children: React.ReactNode }) {
  return (
    <ul className={`${CARD} divide-y divide-zinc-200/80 dark:divide-zinc-800/60`}>{children}</ul>
  );
}

/**
 * Phone per appointment: a walk-in customer's own; for a registered client,
 * the one the garage noted (0042) or else the one on their profile (0044).
 */
async function phonesFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  garageId: string,
  rows: AgendaAppointment[]
): Promise<Map<string, string>> {
  const clientIds = [
    ...new Set(rows.map((row) => row.client_id).filter((id): id is string => Boolean(id))),
  ];
  const noted = new Map<string, string>();
  if (clientIds.length > 0) {
    const { data } = await supabase
      .from("garage_client_notes")
      .select("client_id, phone")
      .eq("garage_id", garageId)
      .in("client_id", clientIds)
      .not("phone", "is", null);
    for (const note of data ?? []) {
      if (note.client_id && note.phone) noted.set(note.client_id, note.phone);
    }
  }
  const phones = new Map<string, string>();
  for (const row of rows) {
    const phone =
      row.walk_in?.phone ??
      (row.client_id ? noted.get(row.client_id) : undefined) ??
      row.profiles?.phone;
    if (phone) phones.set(row.id, phone);
  }
  return phones;
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

/**
 * Empty agenda: the drawing, what's (not) there, and the one useful next
 * step -- logging a walk-in -- with the calendar as the secondary way out.
 */
function EmptyAgenda({
  text,
  lang,
  d,
  walkIn,
}: {
  text: string;
  lang: Locale;
  d: D;
  walkIn: Dictionary["walkIn"];
}) {
  return (
    <div className={`${CARD} flex flex-col items-center gap-4 px-6 py-12 text-center`}>
      <EmptyCalendarGraphic />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{text}</p>
      <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-3">
        <QuickWalkInButton lang={lang} d={walkIn} label={d.logWalkIn} />
        <Link
          href={`/${lang}/garage/calendar`}
          className="inline-flex items-center gap-1 text-sm font-medium text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {d.viewFullCalendar}
          <ArrowRight aria-hidden className="h-4 w-4" />
        </Link>
      </div>
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
    <Link href={href} className={`${CARD_INTERACTIVE} ${KPI_ITEM} group flex flex-col gap-3 p-4 sm:p-5`}>
      <div className="flex items-center justify-between gap-2">
        <p className={SECTION_LABEL}>{label}</p>
        <Icon
          aria-hidden
          className={`h-4 w-4 shrink-0 ${
            highlight ? "text-amber-600 dark:text-amber-400" : "text-zinc-400 dark:text-zinc-500"
          }`}
          strokeWidth={1.75}
        />
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
      className={`${CARD_INTERACTIVE} ${KPI_ITEM} group flex flex-col gap-3 p-4 sm:p-5`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={SECTION_LABEL}>{d.capacityTitle}</p>
        <Gauge aria-hidden className="h-4 w-4 shrink-0 text-zinc-400 dark:text-zinc-500" strokeWidth={1.75} />
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
    const phones = await phonesFor(supabase, garage.id, rows);
    const upcoming = rows.filter(isUpcoming);
    const other = rows.filter((appointment) => !upcoming.includes(appointment));

    return (
      <div className="flex flex-1 flex-col bg-zinc-50 px-4 py-8 dark:bg-black sm:px-8 sm:py-10">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-8">
          {pageHeader}
          <section className="flex flex-col gap-3">
            <h2 className={SECTION_LABEL}>{d.yourAssignedAppointments}</h2>
            {upcoming.length > 0 ? (
              <AppointmentList>
                {upcoming.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    phone={phones.get(appointment.id) ?? null}
                    lang={lang}
                    dateLocale={dateLocale}
                    now={now}
                    d={d}
                    stageLabels={stageLabels}
                    showDay
                  />
                ))}
              </AppointmentList>
            ) : (
              <EmptyAgenda text={d.noUpcomingAssigned} lang={lang} d={d} walkIn={dictionary.walkIn} />
            )}
          </section>

          {other.length > 0 && (
            <section className="flex flex-col gap-3">
              <h2 className={SECTION_LABEL}>{d.pastAndCancelled}</h2>
              <AppointmentList>
                {other.map((appointment) => (
                  <AppointmentRow
                    key={appointment.id}
                    appointment={appointment}
                    phone={phones.get(appointment.id) ?? null}
                    lang={lang}
                    dateLocale={dateLocale}
                    now={now}
                    d={d}
                    stageLabels={stageLabels}
                    showDay
                  />
                ))}
              </AppointmentList>
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
    { count: readyForPickupCount },
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
    // Cars that are done and waiting for their owner, whatever day they
    // were booked: they stay here until the job is marked complete.
    ownerSupabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("garage_id", garage.id)
      .eq("status", "confirmed")
      .eq("repair_stage", "ready_for_pickup"),
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
  const phones = await phonesFor(ownerSupabase, garage.id, weekAppointments);
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

  function renderList(list: AgendaAppointment[], emptyText: string, showDay: boolean) {
    if (list.length === 0) {
      return <EmptyAgenda text={emptyText} lang={lang} d={d} walkIn={dictionary.walkIn} />;
    }
    return (
      <AppointmentList>
        {list.map((appointment) => (
          <AppointmentRow
            key={appointment.id}
            appointment={appointment}
            phone={phones.get(appointment.id) ?? null}
            lang={lang}
            dateLocale={dateLocale}
            now={now}
            d={d}
            stageLabels={stageLabels}
            showDay={showDay}
          />
        ))}
      </AppointmentList>
    );
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

        <div className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:gap-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
          <KpiCard
            href={`/${lang}/garage/calendar`}
            icon={CalendarClock}
            label={d.statUpcoming}
            value={upcomingCount ?? 0}
            hint={d.kpiUpcomingHint}
          />
          <KpiCard
            href={`/${lang}/garage/calendar`}
            icon={KeyRound}
            label={d.statReadyForPickup}
            value={readyForPickupCount ?? 0}
            hint={d.kpiReadyForPickupHint}
            highlight={(readyForPickupCount ?? 0) > 0}
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
                  panel: renderList(todayAppointments, d.emptyToday, false),
                },
                {
                  id: "week",
                  label: d.tabWeek,
                  count: weekAppointments.length,
                  panel: renderList(weekAppointments, d.emptyWeek, true),
                },
              ]}
            />
          </section>

          <aside className="lg:border-l lg:border-zinc-200/80 lg:pl-6 dark:lg:border-zinc-800/60">
            <MobileCollapsible label={d.overviewToggle}>
            <section aria-labelledby="glance-title">
              <h2 id="glance-title" className={SECTION_LABEL}>
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
                <div className="flex flex-col gap-1 border-t border-zinc-200/80 pt-3 dark:border-zinc-800/60">
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

            <section aria-labelledby="team-title" className="border-t border-zinc-200/80 pt-8 dark:border-zinc-800/60">
              <div className="flex items-center justify-between gap-2">
                <h2 id="team-title" className={SECTION_LABEL}>
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
            </section>

            <PushNotificationOptIn />
            </MobileCollapsible>
          </aside>
        </div>
      </div>
    </div>
  );
}
