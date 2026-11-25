import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Clock,
  Hourglass,
  Info,
  KeyRound,
  LogIn,
  Phone,
  type LucideIcon,
} from "lucide-react";
import { getAuthedProfile, getGarageMembership } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { logout } from "@/app/actions/auth";
import { acceptMechanicInvite, declineMechanicInvite } from "@/app/actions/staff";
import { completeAppointment, confirmAppointment, updateRepairStage } from "@/app/actions/appointments";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LicensePlate } from "@/components/license-plate";
import { PushNotificationOptIn } from "@/components/push-notification-opt-in";
import { QuickWalkInButton } from "@/components/quick-walk-in-modal";
import { REPAIR_STAGES } from "@/lib/definitions";
import { getBookableWindowsForDate } from "@/lib/availability";
import {
  computeDayCapacity,
  formatMinutes,
  isOpenAt,
  mechanicStatus,
  type DayCapacity,
  type MechanicStatus,
} from "@/lib/dashboard";
import { BOARD_COLUMNS, groupBoard, nextStep, type BoardColumn } from "@/lib/job-board";
import {
  APP_TIME_ZONE,
  addDaysToDateKey,
  dateKeyInAppZone,
  dateKeyToDisplayDate,
  dayOfWeekForDateKey,
  todayKeyInAppZone,
  zonedStartOfDay,
} from "@/lib/timezone";
import {
  CLIENT_CARD,
  CLIENT_PRIMARY_BUTTON,
  CLIENT_SECONDARY_BUTTON,
  CLIENT_SECTION_LABEL,
  CLIENT_TEXT_LINK,
  CLIENT_TINTED_PILL,
} from "@/lib/client-ui";
import { AppointmentActionsMenu } from "./appointment-actions-menu";

type D = Dictionary["garageDashboard"];
type StageLabels = Dictionary["common"]["repairStage"];

// The vehicle embed is visible to garage members only for vehicles booked
// with this garage (vehicles RLS, 0036/0038); null when there is none.
const APPOINTMENT_SELECT =
  "id, client_id, start_time, end_time, status, repair_stage, assigned_mechanic_id, services(name), profiles!appointments_client_id_fkey(full_name, phone), walk_in:garage_customers(full_name, phone), vehicle:vehicles(model, year, license_plate, brands(name))";

// What today's board shows: old pending bookings still awaiting a confirm,
// confirmed jobs, and what's been completed today.
const BOARD_STATUSES = ["pending", "confirmed", "completed"];

type Job = {
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

type Mechanic = { id: string; name: string };

const COLUMN_STYLE: Record<BoardColumn, { dot: string; labelKey: keyof D; emptyKey: keyof D }> = {
  arriving: { dot: "bg-brand-600 dark:bg-brand-400", labelKey: "colArriving", emptyKey: "emptyArriving" },
  in_workshop: { dot: "bg-amber-500", labelKey: "colInWorkshop", emptyKey: "emptyInWorkshop" },
  ready: { dot: "bg-emerald-500", labelKey: "colReady", emptyKey: "emptyReady" },
  done: { dot: "bg-zinc-400 dark:bg-zinc-500", labelKey: "colDone", emptyKey: "emptyDone" },
};

const TEAM_DOT: Record<MechanicStatus["kind"], string> = {
  busy: "bg-amber-500",
  free: "bg-emerald-500",
  off: "bg-zinc-400 dark:bg-zinc-600",
};

function timeFormatter(lang: Locale) {
  // 24-hour clock in both languages (Luxembourg usage).
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "en-GB", {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

function shortDay(iso: string, dateLocale: string) {
  return new Date(iso).toLocaleDateString(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

function customerName(job: Job, d: D) {
  return job.profiles?.full_name ?? job.walk_in?.full_name ?? d.clientFallback;
}

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

/**
 * Phone per job: a walk-in customer's own; for a registered client, the
 * one the garage noted (0042) or else the one on their profile (0044).
 */
async function phonesFor(
  supabase: Awaited<ReturnType<typeof createClient>>,
  garageId: string,
  rows: Job[]
): Promise<Map<string, string>> {
  const clientIds = [...new Set(rows.map((row) => row.client_id).filter((id): id is string => Boolean(id)))];
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
    const phone = row.walk_in?.phone ?? (row.client_id ? noted.get(row.client_id) : undefined) ?? row.profiles?.phone;
    if (phone) phones.set(row.id, phone);
  }
  return phones;
}

/** The repair stages as five segments, the current one and before filled. */
function StageTrack({ stage, labels }: { stage: string | null; labels: StageLabels }) {
  const current = stage ? REPAIR_STAGES.indexOf(stage as (typeof REPAIR_STAGES)[number]) : -1;
  if (current < 0) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="font-semibold text-ink">{labels[REPAIR_STAGES[current]]}</span>
        <span className="tabular-nums text-ink-muted">
          {current + 1}/{REPAIR_STAGES.length}
        </span>
      </div>
      <ol className="grid grid-cols-5 gap-1" aria-hidden>
        {REPAIR_STAGES.map((key, index) => (
          <li key={key} className={`h-1 rounded-full ${index <= current ? "bg-ink" : "bg-hairline"}`} />
        ))}
      </ol>
    </div>
  );
}

/**
 * One car on the board: when, what, who, which car, where it stands, and
 * the single button that moves it to the next step. Everything else
 * (message, reschedule, any stage, cancel) is in the "more" menu.
 */
function JobCard({
  job,
  phone,
  mechanicName,
  lang,
  dateLocale,
  todayKey,
  now,
  d,
  stageLabels,
  actionable,
}: {
  job: Job;
  phone: string | null;
  // Owner view only: who has the job.
  mechanicName: string | null | undefined;
  lang: Locale;
  dateLocale: string;
  todayKey: string;
  now: Date;
  d: D;
  stageLabels: StageLabels;
  // Future-day jobs (the mechanic's "coming up" list) can't be advanced yet.
  actionable: boolean;
}) {
  const formatTime = timeFormatter(lang);
  const startDay = dateKeyInAppZone(new Date(job.start_time));
  const isOpen = job.status === "pending" || job.status === "confirmed";
  const late =
    job.status === "confirmed" &&
    job.repair_stage === null &&
    startDay === todayKey &&
    new Date(job.start_time).getTime() < now.getTime();
  const vehicle = job.vehicle;
  const plate = vehicle?.license_plate?.trim();
  const vehicleText = vehicle ? [vehicle.brands?.name, vehicle.model, vehicle.year].filter(Boolean).join(" ") : "";
  const step = actionable ? nextStep(job) : null;
  const stepLabel =
    step?.kind === "confirm"
      ? d.confirm
      : step?.kind === "complete"
        ? d.actionPickedUp
        : step?.kind === "stage"
          ? step.stage === "received"
            ? d.actionCheckIn
            : d.actionToStage.replace("{stage}", stageLabels[step.stage])
          : null;
  const StepIcon: LucideIcon = step?.kind === "complete" ? KeyRound : step?.kind === "stage" && step.stage === "received" ? LogIn : step?.kind === "confirm" ? Check : ArrowRight;

  return (
    <li className={`${CLIENT_CARD} flex flex-col gap-3 p-4`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="inline-flex items-center gap-1 text-sm font-bold tabular-nums text-ink">
            <Clock aria-hidden className="h-3.5 w-3.5 text-ink-muted" strokeWidth={2} />
            {formatTime.format(new Date(job.start_time))}
          </span>
          {startDay !== todayKey && (
            <span className="text-xs font-medium text-ink-muted">
              {startDay < todayKey ? d.sinceDay.replace("{day}", shortDay(job.start_time, dateLocale)) : shortDay(job.start_time, dateLocale)}
            </span>
          )}
          {late && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {d.late}
            </span>
          )}
          {job.status === "pending" && (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              {d.badgeAwaitingAction}
            </span>
          )}
        </div>
        <AppointmentActionsMenu
          appointmentId={job.id}
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
          canMessage={job.profiles !== null}
          isOpen={isOpen}
          // The card's own button already completes a car that's ready.
          showComplete={isOpen && step?.kind !== "complete"}
          stages={job.status === "confirmed" ? REPAIR_STAGES.map((value) => ({ value, label: stageLabels[value] })) : null}
          currentStage={job.repair_stage}
        />
      </div>

      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-[15px] font-bold leading-snug tracking-tight text-ink">
          {job.services?.name ?? d.serviceFallback}
        </p>
        <p className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
          <span className="font-medium text-ink">{customerName(job, d)}</span>
          {phone && (
            <a
              href={`tel:${phone.replace(/[^\d+]/g, "")}`}
              className="inline-flex items-center gap-1 tabular-nums text-ink-muted hover:text-ink hover:underline"
            >
              <Phone aria-hidden className="h-3.5 w-3.5" strokeWidth={1.75} />
              {phone}
            </a>
          )}
        </p>
        {(plate || vehicleText) && (
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-ink-muted">
            {plate && <LicensePlate plate={plate} label={d.plateLabel} />}
            {vehicleText && <span className="truncate">{vehicleText}</span>}
          </p>
        )}
        {mechanicName !== undefined && (
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
            <span
              aria-hidden
              className="flex h-5 w-5 items-center justify-center rounded-full bg-subtle text-[10px] font-semibold text-ink"
            >
              {mechanicName ? initials(mechanicName) : "?"}
            </span>
            {mechanicName ? d.assignedTo.replace("{name}", mechanicName) : d.unassigned}
          </p>
        )}
      </div>

      {job.status === "confirmed" && <StageTrack stage={job.repair_stage} labels={stageLabels} />}

      {step && stepLabel && (
        <form
          action={step.kind === "confirm" ? confirmAppointment : step.kind === "complete" ? completeAppointment : updateRepairStage}
        >
          <input type="hidden" name="id" value={job.id} />
          <input type="hidden" name="lang" value={lang} />
          {step.kind === "stage" && <input type="hidden" name="stage" value={step.stage} />}
          <button
            type="submit"
            className={`${step.kind === "complete" || step.kind === "confirm" ? CLIENT_PRIMARY_BUTTON : CLIENT_TINTED_PILL} w-full`}
          >
            <StepIcon aria-hidden className="h-4 w-4" strokeWidth={2} />
            <span className="truncate">{stepLabel}</span>
          </button>
        </form>
      )}
    </li>
  );
}

function Board({
  columns,
  render,
  d,
}: {
  columns: Record<BoardColumn, Job[]>;
  render: (job: Job) => React.ReactNode;
  d: D;
}) {
  return (
    <section aria-labelledby="board-title" className="flex flex-col gap-4">
      <h2 id="board-title" className="sr-only">
        {d.boardLabel}
      </h2>
      <div className="grid grid-cols-1 items-start gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {BOARD_COLUMNS.map((key) => {
          const style = COLUMN_STYLE[key];
          const jobs = columns[key];
          return (
            <section
              key={key}
              aria-labelledby={`col-${key}`}
              className="flex min-w-0 flex-col gap-3 rounded-2xl bg-subtle/60 p-3 dark:bg-subtle/40"
            >
              <h3 id={`col-${key}`} className="flex items-center gap-2 px-1 pt-1 text-sm font-bold tracking-tight text-ink">
                <span aria-hidden className={`h-2 w-2 rounded-full ${style.dot}`} />
                {d[style.labelKey] as string}
                <span className="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-semibold tabular-nums text-ink-muted">
                  {jobs.length}
                </span>
              </h3>
              {jobs.length > 0 ? (
                <ul className="flex flex-col gap-2.5">{jobs.map(render)}</ul>
              ) : (
                <p className="rounded-xl border border-dashed border-hairline px-3 py-6 text-center text-sm text-ink-muted">
                  {d[style.emptyKey] as string}
                </p>
              )}
            </section>
          );
        })}
      </div>
    </section>
  );
}

function capacityTone(percent: number) {
  if (percent >= 100) return { bar: "bg-red-500", labelKey: "capacityFull" as const };
  if (percent >= 80) return { bar: "bg-amber-500", labelKey: "capacityNearlyFull" as const };
  return { bar: "bg-brand-600 dark:bg-brand-500", labelKey: "capacityAvailable" as const };
}

/** Today in one card: four figures side by side, split by hairlines. */
function SummaryStrip({
  todayCount,
  inWorkshop,
  ready,
  capacity,
  lang,
  d,
}: {
  todayCount: number;
  inWorkshop: number;
  ready: number;
  capacity: DayCapacity;
  lang: Locale;
  d: D;
}) {
  const open = capacity.kind === "open" ? capacity : null;
  const tone = open ? capacityTone(open.percent) : null;
  const stateText = open && tone ? d[tone.labelKey] : capacity.kind === "closed" ? d.capacityClosed : d.capacityNoMechanics;
  const figure = (label: string, value: number, accent?: string) => (
    <div className="flex flex-col gap-1 p-4 sm:p-5">
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className={`font-display text-3xl font-bold tabular-nums tracking-tight ${accent ?? "text-ink"}`}>{value}</p>
    </div>
  );
  return (
    <div className={`${CLIENT_CARD} grid grid-cols-2 divide-hairline lg:grid-cols-4 [&>*]:border-hairline [&>*:nth-child(2n)]:border-l lg:[&>*:not(:first-child)]:border-l [&>*:nth-child(n+3)]:border-t lg:[&>*:nth-child(n+3)]:border-t-0`}>
      {figure(d.summaryToday, todayCount)}
      {figure(d.summaryInWorkshop, inWorkshop)}
      {figure(d.summaryReady, ready, ready > 0 ? "text-emerald-600 dark:text-emerald-400" : undefined)}
      <Link
        href={`/${lang}/garage/${capacity.kind === "no_mechanics" ? "staff" : "availability"}`}
        className="flex flex-col gap-2 p-4 transition-colors hover:bg-subtle/50 sm:p-5"
      >
        <p className="text-sm font-medium text-ink-muted">{d.capacityTitle}</p>
        <div className="flex items-baseline gap-2">
          <span className="font-display text-3xl font-bold tabular-nums tracking-tight text-ink">
            {open ? `${open.percent}%` : "–"}
          </span>
          <span className="truncate text-xs font-medium text-ink-muted">{stateText}</span>
        </div>
        <div
          role="meter"
          aria-label={d.capacityTitle}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={open?.percent ?? 0}
          aria-valuetext={
            open
              ? `${open.percent}%, ${d.capacityBooked
                  .replace("{booked}", formatMinutes(open.bookedMinutes))
                  .replace("{capacity}", formatMinutes(open.capacityMinutes))}`
              : stateText
          }
          className="h-1.5 overflow-hidden rounded-full bg-hairline"
        >
          {open && tone && (
            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(open.percent, 100)}%` }} />
          )}
        </div>
      </Link>
    </div>
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
    <div className={`flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${toneClass}`}>
      <div className="flex min-w-0 items-start gap-3">
        <Icon aria-hidden className="mt-0.5 h-4 w-4 shrink-0 opacity-80" strokeWidth={2} />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{title}</p>
          <p className="text-sm opacity-80">{description}</p>
        </div>
      </div>
      {children && <div className="flex shrink-0 items-center gap-2 pl-7 sm:pl-0">{children}</div>}
    </div>
  );
}

const CALLOUT_BUTTON =
  "inline-flex items-center rounded-xl bg-amber-900 px-4 py-2 text-sm font-semibold text-amber-50 transition-colors hover:bg-amber-800 dark:bg-amber-300 dark:text-amber-950 dark:hover:bg-amber-200";

function teamStatusText(status: MechanicStatus, d: D, formatTime: (iso: string) => string) {
  if (status.kind === "busy") return d.teamBusyUntil.replace("{time}", formatTime(status.until));
  if (status.kind === "free") {
    return status.nextAt ? d.teamFreeNext.replace("{time}", formatTime(status.nextAt)) : d.teamFree;
  }
  return status.nextAt ? d.teamOffNext.replace("{time}", formatTime(status.nextAt)) : d.teamOff;
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
  searchParams: Promise<{ invite?: string }>;
}) {
  const { lang: rawLang } = await params;
  const { invite: inviteResult } = await searchParams;
  const lang = resolveLocale(rawLang);
  const profile = await getAuthedProfile(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageDashboard;
  const stageLabels = dictionary.common.repairStage;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-GB";
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
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas px-4 py-16">
        <div className={`${CLIENT_CARD} flex w-full max-w-md flex-col gap-4 p-8`}>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {pendingInvites.length > 0 ? d.invitesTitle : d.noGarageTitle}
          </h1>
          {resultKey && (
            <p role="status" className="rounded-xl bg-subtle px-3.5 py-2.5 text-sm text-ink">
              {d[resultKey]}
            </p>
          )}
          {pendingInvites.length > 0 ? (
            <div className="flex flex-col gap-3">
              <p className="text-sm text-ink-muted">{d.invitesDescription}</p>
              {pendingInvites.map((invite) => (
                <div key={invite.id} className="flex flex-col gap-3 rounded-xl border border-hairline p-4">
                  <div>
                    <p className="font-semibold text-ink">{invite.garage_name}</p>
                    <p className="text-xs text-ink-muted">
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
                      <button type="submit" className={CLIENT_PRIMARY_BUTTON}>
                        {d.acceptInvite}
                      </button>
                    </form>
                    <form action={declineMechanicInvite}>
                      <input type="hidden" name="lang" value={lang} />
                      <input type="hidden" name="inviteId" value={invite.id} />
                      <button type="submit" className={CLIENT_SECONDARY_BUTTON}>
                        {d.declineInvite}
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-ink-muted">{d.noGarageDescription}</p>
          )}
          <Link href={`/${lang}/account`} className={`${CLIENT_TEXT_LINK} self-start`}>
            {d.account}
          </Link>
          <LanguageSwitcher lang={lang} />
          <form action={logout}>
            <input type="hidden" name="lang" value={lang} />
            <button type="submit" className={CLIENT_SECONDARY_BUTTON}>
              {d.logOut}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { garage, isOwner } = membership;

  if (isOwner && !garage.platform_terms_accepted_at) {
    redirect(`/${lang}/garage/onboarding`);
  }

  const supabase = await createClient();
  const todayKey = todayKeyInAppZone(now);
  const todayLabel = dateKeyToDisplayDate(todayKey).toLocaleDateString(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // Day and week boundaries in the garage's zone, not the server's (UTC on
  // Vercel). "This week" runs to the end of Sunday.
  const todayStart = zonedStartOfDay(todayKey);
  const tomorrowStart = zonedStartOfDay(addDaysToDateKey(todayKey, 1));
  const diffToMonday = (dayOfWeekForDateKey(todayKey) + 6) % 7;
  const endOfWeek = zonedStartOfDay(addDaysToDateKey(todayKey, 7 - diffToMonday));

  // A mechanic sees their own jobs; the owner sees the whole workshop.
  let todayQuery = supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("garage_id", garage.id)
    .in("status", BOARD_STATUSES)
    .gte("start_time", todayStart.toISOString())
    .lt("start_time", tomorrowStart.toISOString());
  // Cars checked in on an earlier day and still in the workshop or waiting
  // for pickup: they stay on the board until handed back.
  let inShopQuery = supabase
    .from("appointments")
    .select(APPOINTMENT_SELECT)
    .eq("garage_id", garage.id)
    .eq("status", "confirmed")
    .not("repair_stage", "is", null)
    .lt("start_time", todayStart.toISOString());
  let laterThisWeekQuery = supabase
    .from("appointments")
    .select("*", { count: "exact", head: true })
    .eq("garage_id", garage.id)
    .in("status", ["pending", "confirmed"])
    .gte("start_time", tomorrowStart.toISOString())
    .lt("start_time", endOfWeek.toISOString());
  if (!isOwner) {
    todayQuery = todayQuery.eq("assigned_mechanic_id", profile.id);
    inShopQuery = inShopQuery.eq("assigned_mechanic_id", profile.id);
    laterThisWeekQuery = laterThisWeekQuery.eq("assigned_mechanic_id", profile.id);
  }

  const [
    { data: todayData },
    { data: inShopData },
    { data: laterData },
    { count: laterThisWeekCount },
    { count: pendingCount },
    { data: todayLoad },
    { windows },
    { data: mechanicCountData },
    { data: staffData },
  ] = await Promise.all([
    todayQuery.order("start_time", { ascending: true }),
    inShopQuery.order("start_time", { ascending: true }).limit(100),
    // A mechanic's next few jobs after today.
    isOwner
      ? Promise.resolve({ data: [] as unknown[] })
      : supabase
          .from("appointments")
          .select(APPOINTMENT_SELECT)
          .eq("garage_id", garage.id)
          .eq("assigned_mechanic_id", profile.id)
          .in("status", ["pending", "confirmed"])
          .gte("start_time", tomorrowStart.toISOString())
          .order("start_time", { ascending: true })
          .limit(12),
    laterThisWeekQuery,
    // Bookings are confirmed on creation now (0040); this only finds paid
    // bookings from before the pilot that still await the garage's OK.
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("garage_id", garage.id)
      .eq("status", "pending"),
    // Capacity: everything holding a mechanic today, including unfinished
    // checkouts (pending_payment holds the slot) and jobs that started
    // yesterday but run into today.
    supabase
      .from("appointments")
      .select("start_time, end_time")
      .eq("garage_id", garage.id)
      .neq("status", "cancelled")
      .lt("start_time", tomorrowStart.toISOString())
      .gt("end_time", todayStart.toISOString()),
    // Opening hours minus intraday blocks (0039).
    getBookableWindowsForDate({ supabase, garageId: garage.id, date: todayKey }),
    supabase.rpc("get_bookable_mechanic_count", { target_garage_id: garage.id }) as unknown as Promise<{
      data: number | null;
    }>,
    supabase.from("garage_staff").select("profiles(id, full_name)").eq("garage_id", garage.id),
  ]);

  const todayJobs = (todayData ?? []) as unknown as Job[];
  const inShopJobs = (inShopData ?? []) as unknown as Job[];
  const laterJobs = (laterData ?? []) as unknown as Job[];
  const phones = await phonesFor(supabase, garage.id, [...todayJobs, ...inShopJobs, ...laterJobs]);
  const board = groupBoard([...inShopJobs, ...todayJobs]);

  const capacity = computeDayCapacity({
    date: todayKey,
    windows,
    mechanicCount: mechanicCountData ?? 0,
    bookings: todayLoad ?? [],
  });

  // Team: the bookable mechanics (0037) -- the owner unless they opted
  // out, plus accepted staff.
  const staff = (staffData ?? [])
    .map((row) => row.profiles as unknown as { id: string; full_name: string } | null)
    .filter((person): person is { id: string; full_name: string } => person !== null);
  const ownerName = isOwner ? (profile.full_name as string) : null;
  const mechanics: Mechanic[] = [
    ...(garage.owner_takes_bookings && isOwner ? [{ id: profile.id, name: ownerName || d.teamYou }] : []),
    ...staff.map((person) => ({ id: person.id, name: person.full_name })),
  ];
  const mechanicNames = new Map(mechanics.map((mechanic) => [mechanic.id, mechanic.name]));
  const shopOpen = isOpenAt({ date: todayKey, windows, now });
  const formatTime = (iso: string) => timeFormatter(lang).format(new Date(iso));
  const hoursText =
    windows.length > 0
      ? windows.map((window) => `${window.start_time.slice(0, 5)}–${window.end_time.slice(0, 5)}`).join(", ")
      : d.glanceClosed;
  const nextArrival = board.arriving.find((job) => new Date(job.start_time).getTime() >= now.getTime());
  const legacyPending = isOwner ? (pendingCount ?? 0) : 0;

  const renderCard = (job: Job, actionable = true) => (
    <JobCard
      key={job.id}
      job={job}
      phone={phones.get(job.id) ?? null}
      mechanicName={
        isOwner ? (job.assigned_mechanic_id ? (mechanicNames.get(job.assigned_mechanic_id) ?? null) : null) : undefined
      }
      lang={lang}
      dateLocale={dateLocale}
      todayKey={todayKey}
      now={now}
      d={d}
      stageLabels={stageLabels}
      actionable={actionable}
    />
  );

  return (
    <div className="flex flex-1 flex-col bg-canvas px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold capitalize text-ink-muted">{todayLabel}</p>
            <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {isOwner ? d.boardTitle : d.yourAssignedAppointments}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/${lang}/garage/calendar`} className={CLIENT_SECONDARY_BUTTON}>
              <CalendarDays aria-hidden className="h-4 w-4" strokeWidth={1.75} />
              {d.viewFullCalendar}
            </Link>
            <QuickWalkInButton lang={lang} d={dictionary.walkIn} label={d.logWalkIn} />
          </div>
        </header>

        {(garage.status !== "approved" || legacyPending > 0) && (
          <div className="flex flex-col gap-3">
            {garage.status !== "approved" && (
              <Callout
                tone={garage.status === "rejected" ? "red" : "amber"}
                icon={Info}
                title={garage.status === "rejected" ? d.garageRejectedTitle : d.garagePendingTitle}
                description={garage.status === "rejected" ? d.garageRejectedDescription : d.garagePendingDescription}
              >
                {isOwner && (
                  <Link href={`/${lang}/garage/profile`} className={CALLOUT_BUTTON}>
                    {d.reviewProfile}
                  </Link>
                )}
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

        <SummaryStrip
          todayCount={todayJobs.length}
          inWorkshop={board.in_workshop.length}
          ready={board.ready.length}
          capacity={capacity}
          lang={lang}
          d={d}
        />

        <Board columns={board} render={(job) => renderCard(job)} d={d} />

        <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
          {/* Next arrival */}
          <section aria-labelledby="next-title" className={`${CLIENT_CARD} flex flex-col gap-3 p-5`}>
            <h2 id="next-title" className={CLIENT_SECTION_LABEL}>
              {d.nextArrival}
            </h2>
            {nextArrival ? (
              <div className="flex items-start gap-4">
                <span className="rounded-xl bg-brand-50 px-3 py-2 text-center text-lg font-bold tabular-nums text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                  {formatTime(nextArrival.start_time)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-bold tracking-tight text-ink">
                    {nextArrival.services?.name ?? d.serviceFallback}
                  </p>
                  <p className="truncate text-sm text-ink-muted">{customerName(nextArrival, d)}</p>
                  {nextArrival.vehicle?.license_plate?.trim() && (
                    <span className="mt-1.5 inline-block">
                      <LicensePlate plate={nextArrival.vehicle.license_plate.trim()} label={d.plateLabel} />
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">{d.noNextArrival}</p>
            )}
          </section>

          {/* Team (owner) or the mechanic's next days */}
          {isOwner ? (
            <section aria-labelledby="team-title" className={`${CLIENT_CARD} flex flex-col gap-3 p-5`}>
              <div className="flex items-center justify-between gap-2">
                <h2 id="team-title" className={CLIENT_SECTION_LABEL}>
                  {d.teamTitle}
                </h2>
                <Link href={`/${lang}/garage/staff`} className={CLIENT_TEXT_LINK}>
                  {d.teamManage}
                </Link>
              </div>
              {mechanics.length === 0 ? (
                <p className="text-sm text-ink-muted">{d.teamEmpty}</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {mechanics.map((mechanic) => {
                    const status = mechanicStatus({ mechanicId: mechanic.id, appointments: todayJobs, now, shopOpen });
                    return (
                      <li key={mechanic.id} className="flex items-center gap-3">
                        <span
                          aria-hidden
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-subtle text-xs font-bold text-ink"
                        >
                          {initials(mechanic.name)}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink">
                            {mechanic.name}
                            {mechanic.id === profile.id && (
                              <span className="font-normal text-ink-muted"> ({d.teamYou})</span>
                            )}
                          </p>
                          <p className="flex items-center gap-1.5 text-xs text-ink-muted">
                            <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${TEAM_DOT[status.kind]}`} />
                            {teamStatusText(status, d, formatTime)}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          ) : (
            <section aria-labelledby="later-title" className="flex flex-col gap-3 lg:col-span-1">
              <h2 id="later-title" className={CLIENT_SECTION_LABEL}>
                {d.upcomingTitle}
              </h2>
              {laterJobs.length > 0 ? (
                <ul className="flex flex-col gap-2.5">{laterJobs.map((job) => renderCard(job, false))}</ul>
              ) : (
                <p className={`${CLIENT_CARD} p-5 text-sm text-ink-muted`}>{d.noUpcomingAssigned}</p>
              )}
            </section>
          )}

          {/* Today's hours and the rest of the week */}
          <section aria-labelledby="hours-title" className={`${CLIENT_CARD} flex flex-col gap-3 p-5`}>
            <h2 id="hours-title" className={CLIENT_SECTION_LABEL}>
              {d.glanceHours}
            </h2>
            <p className="inline-flex items-center gap-2 text-sm font-semibold tabular-nums text-ink">
              <span
                aria-hidden
                className={`h-2 w-2 rounded-full ${shopOpen ? "bg-emerald-500" : "bg-zinc-400 dark:bg-zinc-600"}`}
              />
              {hoursText}
            </p>
            <Link href={`/${lang}/garage/calendar?view=week`} className={`${CLIENT_TEXT_LINK} self-start`}>
              {d.upcomingWeek.replace("{count}", String(laterThisWeekCount ?? 0))}
              <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
            </Link>
            <div className="border-t border-hairline pt-3">
              <PushNotificationOptIn />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
