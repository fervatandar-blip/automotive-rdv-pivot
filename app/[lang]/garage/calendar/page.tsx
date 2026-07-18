import Link from "next/link";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  addDays,
  addMonths,
  monthGridDays,
  parseDateKey,
  startOfMonth,
  startOfWeek,
  todayKey,
  toDateKey,
} from "@/lib/calendar";
import { DEFAULT_STATUS_STYLE, STATUS_STYLES } from "@/lib/status";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import {
  assignMechanic,
  completeAppointment,
  confirmAppointment,
  providerCancelAppointment,
} from "@/app/actions/appointments";

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

type CalendarAppointment = {
  id: string;
  start_time: string;
  status: string;
  assigned_mechanic_id: string | null;
  services: { name: string } | null;
  profiles: { full_name: string } | null;
};

type Mechanic = { id: string; full_name: string };

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function AppointmentChip({
  appointment,
  lang,
  mechanics,
  isOwner,
  compact = false,
}: {
  appointment: CalendarAppointment;
  lang: Locale;
  mechanics: Mechanic[];
  isOwner: boolean;
  compact?: boolean;
}) {
  const style = STATUS_STYLES[appointment.status] ?? DEFAULT_STATUS_STYLE;
  const canConfirm = appointment.status === "pending";
  const canComplete =
    appointment.status === "pending" || appointment.status === "confirmed";
  const canCancel =
    appointment.status === "pending" || appointment.status === "confirmed";
  const canReschedule = canCancel;
  const showActions =
    !compact && (canConfirm || canComplete || canReschedule || canCancel);
  const assignedMechanic = mechanics.find(
    (mechanic) => mechanic.id === appointment.assigned_mechanic_id
  );

  return (
    <div
      className={`flex items-start gap-1.5 rounded-md border px-2 py-1 text-xs ${style.bg} ${style.border}`}
    >
      <span
        className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full"
        style={{ backgroundColor: style.dot }}
        aria-hidden
      />
      <div className="min-w-0">
        <p className={`font-medium ${style.text}`}>
          {formatTime(appointment.start_time)}
          {!compact && ` · ${style.label}`}
        </p>
        <p className="truncate text-zinc-700 dark:text-zinc-300">
          {appointment.services?.name ?? "Service"}
        </p>
        {!compact && (
          <p className="truncate text-zinc-500 dark:text-zinc-500">
            {appointment.profiles?.full_name ?? "Client"}
          </p>
        )}
        {compact && assignedMechanic && (
          <p className="truncate text-zinc-500 dark:text-zinc-500">
            {assignedMechanic.full_name}
          </p>
        )}
        {!compact && (
          <p className="truncate text-zinc-500 dark:text-zinc-500">
            {assignedMechanic
              ? `Assigned: ${assignedMechanic.full_name}`
              : "Unassigned"}
          </p>
        )}
        {!compact && isOwner && mechanics.length > 0 && (
          <form action={assignMechanic} className="mt-1.5 flex gap-1">
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="lang" value={lang} />
            <select
              name="mechanicId"
              defaultValue={appointment.assigned_mechanic_id ?? ""}
              className="min-w-0 flex-1 rounded border border-black/[.08] bg-white px-1 py-0.5 text-[11px] dark:border-white/[.145] dark:bg-black"
            >
              <option value="">Unassigned</option>
              {mechanics.map((mechanic) => (
                <option key={mechanic.id} value={mechanic.id}>
                  {mechanic.full_name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="shrink-0 rounded border border-black/[.08] bg-white px-1.5 py-0.5 text-[11px] font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:bg-black dark:hover:bg-[#1a1a1a]"
            >
              Set
            </button>
          </form>
        )}
        {showActions && (
          <div className="mt-1.5 flex flex-col gap-1">
            {canConfirm && (
              <form action={confirmAppointment}>
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="lang" value={lang} />
                <button
                  type="submit"
                  className="w-full rounded border border-black/[.08] bg-white px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:bg-black dark:hover:bg-[#1a1a1a]"
                >
                  Confirm
                </button>
              </form>
            )}
            {canComplete && (
              <form action={completeAppointment}>
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="lang" value={lang} />
                <button
                  type="submit"
                  className="w-full rounded border border-black/[.08] bg-white px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:bg-black dark:hover:bg-[#1a1a1a]"
                >
                  Complete
                </button>
              </form>
            )}
            {canReschedule && (
              <Link
                href={`/${lang}/appointments/${appointment.id}/reschedule`}
                className="w-full rounded border border-black/[.08] bg-white px-1.5 py-0.5 text-left text-[11px] font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:bg-black dark:hover:bg-[#1a1a1a]"
              >
                Reschedule
              </Link>
            )}
            {canCancel && (
              <form action={providerCancelAppointment}>
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="lang" value={lang} />
                <button
                  type="submit"
                  className="w-full rounded border border-black/[.08] bg-white px-1.5 py-0.5 text-left text-[11px] font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:bg-black dark:hover:bg-[#1a1a1a]"
                >
                  Cancel
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-400">
      {Object.values(STATUS_STYLES).map((style) => (
        <div key={style.label} className="flex items-center gap-1.5">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: style.dot }}
            aria-hidden
          />
          {style.label}
        </div>
      ))}
    </div>
  );
}

function ToggleLink({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        active
          ? "bg-foreground text-background"
          : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
      }`}
    >
      {children}
    </Link>
  );
}

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="rounded-full border border-black/[.08] px-3 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
    >
      {children}
    </Link>
  );
}

export default async function GarageCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ view?: string; date?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage, isOwner } = await requireGarageMember(lang);
  const { view: viewParam, date: dateParam } = await searchParams;
  const view = viewParam === "month" ? "month" : "week";
  const anchor = parseDateKey(dateParam ?? todayKey());

  const rangeDays =
    view === "week"
      ? Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(anchor), i))
      : monthGridDays(anchor);
  const rangeStart = rangeDays[0];
  const rangeEnd = addDays(rangeDays[rangeDays.length - 1], 1);

  const supabase = await createClient();

  const { data: staffRows } = await supabase
    .from("garage_staff")
    .select("profiles(id, full_name)")
    .eq("garage_id", garage.id);
  const mechanics = (staffRows ?? [])
    .map((row) => row.profiles as unknown as Mechanic | null)
    .filter((mechanic): mechanic is Mechanic => mechanic !== null);

  const { data: appointments } = await supabase
    .from("appointments")
    .select(
      "id, start_time, status, assigned_mechanic_id, services(name), profiles!appointments_client_id_fkey(full_name)"
    )
    .eq("garage_id", garage.id)
    .gte("start_time", rangeStart.toISOString())
    .lt("start_time", rangeEnd.toISOString())
    .order("start_time", { ascending: true });

  const rows = (appointments ?? []) as unknown as CalendarAppointment[];
  const byDay = new Map<string, CalendarAppointment[]>();
  for (const appointment of rows) {
    const key = toDateKey(new Date(appointment.start_time));
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)?.push(appointment);
  }

  const todaysKey = todayKey();
  const anchorKey = toDateKey(anchor);
  const prevAnchor =
    view === "week" ? addDays(anchor, -7) : addMonths(startOfMonth(anchor), -1);
  const nextAnchor =
    view === "week" ? addDays(anchor, 7) : addMonths(startOfMonth(anchor), 1);

  const heading =
    view === "week"
      ? `${MONTH_LABELS[rangeDays[0].getMonth()]} ${rangeDays[0].getDate()} – ${MONTH_LABELS[rangeDays[6].getMonth()]} ${rangeDays[6].getDate()}, ${rangeDays[6].getFullYear()}`
      : `${MONTH_LABELS[anchor.getMonth()]} ${anchor.getFullYear()}`;

  return (
    <div className="flex flex-1 flex-col gap-6 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
        <div className="flex items-start justify-between">
          <div>
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; Back to dashboard
            </Link>
            <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
              {heading}
            </h1>
          </div>
          <LanguageSwitcher lang={lang} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex rounded-full border border-black/[.08] p-1 dark:border-white/[.145]">
            <ToggleLink
              href={`/${lang}/garage/calendar?view=week&date=${anchorKey}`}
              active={view === "week"}
            >
              Week
            </ToggleLink>
            <ToggleLink
              href={`/${lang}/garage/calendar?view=month&date=${anchorKey}`}
              active={view === "month"}
            >
              Month
            </ToggleLink>
          </div>

          <div className="flex items-center gap-2">
            <NavLink
              href={`/${lang}/garage/calendar?view=${view}&date=${toDateKey(prevAnchor)}`}
            >
              &larr;
            </NavLink>
            <NavLink
              href={`/${lang}/garage/calendar?view=${view}&date=${todaysKey}`}
            >
              Today
            </NavLink>
            <NavLink
              href={`/${lang}/garage/calendar?view=${view}&date=${toDateKey(nextAnchor)}`}
            >
              &rarr;
            </NavLink>
          </div>
        </div>

        <StatusLegend />

        {view === "week" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-7">
            {rangeDays.map((day) => {
              const key = toDateKey(day);
              const dayAppointments = byDay.get(key) ?? [];
              const isToday = key === todaysKey;

              return (
                <div
                  key={key}
                  className={`flex flex-col gap-2 rounded-xl border bg-white p-3 dark:bg-zinc-950 ${
                    isToday
                      ? "border-black dark:border-white"
                      : "border-black/[.08] dark:border-white/[.145]"
                  }`}
                >
                  <div className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {WEEKDAY_LABELS[day.getDay()]}{" "}
                    <span className="text-black dark:text-zinc-50">
                      {day.getDate()}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {dayAppointments.length > 0 ? (
                      dayAppointments.map((appointment) => (
                        <AppointmentChip
                          key={appointment.id}
                          appointment={appointment}
                          lang={lang}
                          mechanics={mechanics}
                          isOwner={isOwner}
                        />
                      ))
                    ) : (
                      <p className="text-xs text-zinc-400 dark:text-zinc-600">
                        &mdash;
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {WEEKDAY_LABELS.map((label) => (
              <div
                key={label}
                className="px-1 text-xs font-medium text-zinc-600 dark:text-zinc-400"
              >
                {label}
              </div>
            ))}
            {rangeDays.map((day) => {
              const key = toDateKey(day);
              const dayAppointments = byDay.get(key) ?? [];
              const isCurrentMonth = day.getMonth() === anchor.getMonth();
              const isToday = key === todaysKey;
              const visible = dayAppointments.slice(0, 3);
              const overflow = dayAppointments.length - visible.length;

              return (
                <div
                  key={key}
                  className={`flex min-h-[110px] flex-col gap-1 rounded-xl border p-2 ${
                    isToday
                      ? "border-black dark:border-white"
                      : "border-black/[.08] dark:border-white/[.145]"
                  } ${
                    isCurrentMonth
                      ? "bg-white dark:bg-zinc-950"
                      : "bg-zinc-100/60 dark:bg-zinc-900/40"
                  }`}
                >
                  <span
                    className={`text-xs font-medium ${
                      isCurrentMonth
                        ? "text-black dark:text-zinc-50"
                        : "text-zinc-400 dark:text-zinc-600"
                    }`}
                  >
                    {day.getDate()}
                  </span>
                  <div className="flex flex-col gap-1">
                    {visible.map((appointment) => (
                      <AppointmentChip
                        key={appointment.id}
                        appointment={appointment}
                        lang={lang}
                        mechanics={mechanics}
                        isOwner={isOwner}
                        compact
                      />
                    ))}
                    {overflow > 0 && (
                      <Link
                        href={`/${lang}/garage/calendar?view=week&date=${key}`}
                        className="text-[11px] font-medium text-zinc-600 underline dark:text-zinc-400"
                      >
                        +{overflow} more
                      </Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
