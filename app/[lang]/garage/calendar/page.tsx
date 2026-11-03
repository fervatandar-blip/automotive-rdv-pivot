import Link from "next/link";
import { ChevronLeft, ChevronRight, Eye, EyeOff } from "lucide-react";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  assignMechanic,
  completeAppointment,
  confirmAppointment,
  providerCancelAppointment,
  updateRepairStage,
} from "@/app/actions/appointments";
import { getScheduleForDates } from "@/lib/availability";
import {
  CALENDAR_VIEWS,
  groupByMechanic,
  hourRange,
  isDateKey,
  minutesOnDate,
  monthGridDates,
  navigationTargets,
  parseCalendarView,
  parseDayLayout,
  weekDates,
  type CalendarView,
  type DayLayout,
} from "@/lib/calendar-grid";
import { REPAIR_STAGES } from "@/lib/definitions";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import {
  APP_TIME_ZONE,
  addDaysToDateKey,
  dateKeyToDisplayDate,
  todayKeyInAppZone,
  zonedStartOfDay,
} from "@/lib/timezone";
import { LicensePlate } from "@/components/license-plate";
import { StyledSelect } from "@/components/styled-select";
import {
  AppointmentList,
  MonthGrid,
  STATUS_DOT,
  TimeGrid,
  customerName,
  timeFormatter,
  type CalendarAppointment,
  type GridColumn,
} from "./calendar-views";
import { DrawerShell } from "./drawer-shell";
import { SlotBookingSurface } from "./slot-booking";

type D = Dictionary["garageCalendar"];
type Mechanic = { id: string; full_name: string };

const APPOINTMENT_SELECT =
  "id, start_time, end_time, status, repair_stage, assigned_mechanic_id, services(name), profiles!appointments_client_id_fkey(full_name), walk_in:garage_customers(full_name, phone), vehicle:vehicles(license_plate, model, brands(name))";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const CONTROL =
  "inline-flex h-9 items-center justify-center rounded-lg border border-zinc-200 bg-white text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 hover:text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";
const DRAWER_BUTTON =
  "inline-flex items-center justify-center rounded-full border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";

type CalendarState = {
  view: CalendarView;
  date: string;
  cancelled: boolean;
  // Day view columns: one per mechanic, or all jobs together.
  by: DayLayout;
};

function calendarHref(lang: Locale, state: CalendarState, extra: { appt?: string } = {}) {
  const params = new URLSearchParams({ view: state.view, date: state.date });
  if (state.cancelled) params.set("cancelled", "1");
  params.set("by", state.by);
  if (extra.appt) params.set("appt", extra.appt);
  return `/${lang}/garage/calendar?${params}`;
}

function heading(view: CalendarView, dates: string[], anchor: string, dateLocale: string) {
  if (view === "day") {
    return dateKeyToDisplayDate(anchor).toLocaleDateString(dateLocale, {
      timeZone: APP_TIME_ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  if (view === "month") {
    return dateKeyToDisplayDate(anchor).toLocaleDateString(dateLocale, {
      timeZone: APP_TIME_ZONE,
      month: "long",
      year: "numeric",
    });
  }
  // "November 2 – 8, 2026" / "2 – 8 novembre 2026", across months and years too.
  return new Intl.DateTimeFormat(dateLocale, {
    timeZone: APP_TIME_ZONE,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).formatRange(dateKeyToDisplayDate(dates[0]), dateKeyToDisplayDate(dates[dates.length - 1]));
}

export default async function GarageCalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{
    view?: string;
    date?: string;
    error?: string;
    appt?: string;
    cancelled?: string;
    by?: string;
  }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage, isOwner, profile } = await requireGarageMember(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageCalendar;
  const statusLabels = dictionary.common.appointmentStatus;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-GB";
  const query = await searchParams;
  const now = new Date();
  const todayKey = todayKeyInAppZone(now);

  const view = parseCalendarView(query.view);
  const anchor = isDateKey(query.date) ? query.date : todayKey;
  // Cancelled jobs are hidden on the grids by default (they'd take room
  // beside live ones); the list always shows them.
  const showCancelled = query.cancelled === "1";
  // `by` is settled once the mechanics are known (its default depends on
  // how many there are); "together" is a safe placeholder until then.
  const state: CalendarState = { view, date: anchor, cancelled: showCancelled, by: "together" };
  const selectedId = query.appt && UUID_PATTERN.test(query.appt) ? query.appt : null;

  const dates =
    view === "day" ? [anchor] : view === "month" ? monthGridDates(anchor) : weekDates(anchor);
  const rangeStart = zonedStartOfDay(dates[0]);
  const rangeEnd = zonedStartOfDay(addDaysToDateKey(dates[dates.length - 1], 1));

  const supabase = await createClient();
  const isGrid = view === "day" || view === "week";

  const [{ data: appointmentData }, { data: staffRows }, { data: ownerProfile }, schedule, { data: selectedData }] =
    await Promise.all([
      // Everything overlapping the range, so overnight jobs show on both days.
      (() => {
        let request = supabase
          .from("appointments")
          .select(APPOINTMENT_SELECT)
          .eq("garage_id", garage.id)
          .lt("start_time", rangeEnd.toISOString())
          .gt("end_time", rangeStart.toISOString())
          .order("start_time", { ascending: true });
        if (view !== "list" && !showCancelled) request = request.neq("status", "cancelled");
        return request;
      })(),
      supabase.from("garage_staff").select("profiles(id, full_name)").eq("garage_id", garage.id),
      garage.owner_takes_bookings
        ? supabase.from("profiles").select("id, full_name").eq("id", garage.owner_id).maybeSingle()
        : Promise.resolve({ data: null }),
      isGrid
        ? getScheduleForDates({ supabase, garageId: garage.id, dates })
        : Promise.resolve(new Map()),
      selectedId
        ? supabase
            .from("appointments")
            .select(
              `${APPOINTMENT_SELECT}, client_id, mechanic:profiles!appointments_assigned_mechanic_id_fkey(full_name)`
            )
            .eq("id", selectedId)
            .eq("garage_id", garage.id)
            .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const appointments = (appointmentData ?? []) as unknown as CalendarAppointment[];
  const mechanics: Mechanic[] = [
    ...(ownerProfile
      ? [{ id: ownerProfile.id as string, full_name: (ownerProfile.full_name as string) || d.ownerFallback }]
      : []),
    ...(staffRows ?? [])
      .map((row) => row.profiles as unknown as Mechanic | null)
      .filter((mechanic): mechanic is Mechanic => mechanic !== null),
  ];
  const mechanicNames = new Map(mechanics.map((mechanic) => [mechanic.id, mechanic.full_name]));
  state.by = parseDayLayout(query.by, mechanics.length);

  const { startHour, endHour } = hourRange({
    windows: isGrid ? [...schedule.values()].flatMap((day) => day.windows) : [],
    events: isGrid
      ? dates.flatMap((date) =>
          appointments
            .map((appointment) => minutesOnDate(appointment, date))
            .filter((span) => span.endMin > span.startMin)
        )
      : [],
  });

  const { prev, next } = navigationTargets(view, anchor);
  const title = heading(view, dates, anchor, dateLocale);
  const hrefForAppointment = (id: string) => calendarHref(lang, state, { appt: id });
  const hrefForDay = (date: string) => calendarHref(lang, { ...state, view: "day", date });
  let columns: GridColumn[];
  if (view === "day" && state.by === "mechanic") {
    const { byMechanic, unassigned } = groupByMechanic(
      appointments,
      mechanics.map((mechanic) => mechanic.id)
    );
    columns = [
      ...mechanics.map((mechanic) => {
        const own = byMechanic.get(mechanic.id) ?? [];
        return {
          key: `mechanic:${mechanic.id}`,
          date: anchor,
          appointments: own,
          mechanicId: mechanic.id,
          header: {
            kind: "mechanic" as const,
            name: mechanic.full_name,
            isYou: mechanic.id === profile.id,
            count: own.filter((appointment) => appointment.status !== "cancelled").length,
          },
        };
      }),
      // Only when something needs it: jobs nobody on the team holds.
      ...(unassigned.length > 0
        ? [
            {
              key: "unassigned",
              date: anchor,
              appointments: unassigned,
              header: {
                kind: "unassigned" as const,
                count: unassigned.filter((appointment) => appointment.status !== "cancelled").length,
              },
            },
          ]
        : []),
    ];
  } else {
    columns = dates.map((date) => ({
      key: date,
      date,
      appointments,
      header: { kind: "date" as const, href: view === "week" ? hrefForDay(date) : null },
    }));
  }

  const viewLabels: Record<CalendarView, string> = {
    day: d.day,
    week: d.week,
    month: d.month,
    list: d.list,
  };

  const selected = selectedData as
    | (CalendarAppointment & { client_id: string | null; mechanic: { full_name: string } | null })
    | null;

  return (
    <div className="flex flex-1 flex-col gap-4 bg-zinc-50 px-4 py-6 dark:bg-zinc-950 sm:px-6 lg:px-8">
      {/* Header bar: date navigation + title on the left, view switcher on the right. */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <nav aria-label={d.dateNavigation} className="flex items-center gap-1.5">
            <Link href={calendarHref(lang, { ...state, date: prev })} aria-label={d.previous} className={`${CONTROL} w-9`}>
              <ChevronLeft className="h-4 w-4" strokeWidth={2} />
            </Link>
            <Link href={calendarHref(lang, { ...state, date: todayKey })} className={`${CONTROL} px-3.5`}>
              {d.today}
            </Link>
            <Link href={calendarHref(lang, { ...state, date: next })} aria-label={d.next} className={`${CONTROL} w-9`}>
              <ChevronRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </nav>
          <h1 className="text-xl font-semibold tracking-tight text-black first-letter:uppercase dark:text-zinc-50">
            {title}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {view === "day" && mechanics.length > 0 && (
            <nav
              aria-label={d.dayLayout}
              className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900"
            >
              {(["together", "mechanic"] as const).map((option) => (
                <Link
                  key={option}
                  href={calendarHref(lang, { ...state, by: option })}
                  aria-current={state.by === option ? "page" : undefined}
                  className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    state.by === option
                      ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                      : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
                  }`}
                >
                  {option === "mechanic" ? d.byMechanic : d.together}
                </Link>
              ))}
            </nav>
          )}
          {view !== "list" && (
            <Link
              href={calendarHref(lang, { ...state, cancelled: !showCancelled })}
              aria-pressed={showCancelled}
              className={`${CONTROL} gap-1.5 px-3 text-xs`}
            >
              {showCancelled ? (
                <EyeOff aria-hidden className="h-3.5 w-3.5" />
              ) : (
                <Eye aria-hidden className="h-3.5 w-3.5" />
              )}
              {showCancelled ? d.hideCancelled : d.showCancelled}
            </Link>
          )}
          <nav
            aria-label={d.viewSwitcher}
            className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-900"
          >
            {CALENDAR_VIEWS.map((option) => (
              <Link
                key={option}
                href={calendarHref(lang, { ...state, view: option })}
                aria-current={option === view ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  option === view
                    ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {viewLabels[option]}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      {(query.error === "mechanic-busy" || query.error === "assign-failed") && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
        >
          {query.error === "mechanic-busy" ? d.mechanicBusyError : d.assignFailedError}
        </p>
      )}

      <StatusLegend statusLabels={statusLabels} d={d} showBlocks={isGrid} />

      {isGrid && (
        <SlotBookingSurface lang={lang} d={dictionary.walkIn}>
          <TimeGrid
            columns={columns}
            schedule={schedule}
            startHour={startHour}
            endHour={endHour}
            todayKey={todayKey}
            now={now}
            lang={lang}
            dateLocale={dateLocale}
            d={d}
            hrefForAppointment={hrefForAppointment}
            selectedId={selectedId}
          />
        </SlotBookingSurface>
      )}
      {view === "month" && (
        <MonthGrid
          dates={dates}
          monthKey={anchor.slice(0, 7)}
          appointments={appointments}
          todayKey={todayKey}
          lang={lang}
          dateLocale={dateLocale}
          d={d}
          hrefForAppointment={hrefForAppointment}
          hrefForDay={hrefForDay}
        />
      )}
      {view === "list" && (
        <AppointmentList
          dates={dates}
          appointments={appointments}
          mechanicNames={mechanicNames}
          todayKey={todayKey}
          lang={lang}
          dateLocale={dateLocale}
          d={d}
          statusLabels={statusLabels}
          hrefForAppointment={hrefForAppointment}
        />
      )}

      {selected && (
        <AppointmentDrawer
          appointment={selected}
          closeHref={calendarHref(lang, state)}
          state={state}
          lang={lang}
          dateLocale={dateLocale}
          d={d}
          dictionary={dictionary}
          mechanics={mechanics}
          isOwner={isOwner}
        />
      )}
    </div>
  );
}

function StatusLegend({
  statusLabels,
  d,
  showBlocks,
}: {
  statusLabels: Dictionary["common"]["appointmentStatus"];
  d: D;
  showBlocks: boolean;
}) {
  const entries = ["confirmed", "pending", "completed", "cancelled"] as const;
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600 dark:text-zinc-400">
      {entries.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span aria-hidden className={`h-2.5 w-1 rounded-full ${STATUS_DOT[status]}`} />
          {statusLabels[status]}
        </li>
      ))}
      {showBlocks && (
        <>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-3 rounded-sm border border-amber-300/70 bg-amber-500/15" />
            {d.blocked}
          </li>
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-3 rounded-sm border border-zinc-300 bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgb(0_0_0/0.12)_2px_4px)] dark:border-zinc-700 dark:bg-[repeating-linear-gradient(135deg,transparent_0_2px,rgb(255_255_255/0.12)_2px_4px)]" />
            {d.closed}
          </li>
        </>
      )}
    </ul>
  );
}

function AppointmentDrawer({
  appointment,
  closeHref,
  state,
  lang,
  dateLocale,
  d,
  dictionary,
  mechanics,
  isOwner,
}: {
  appointment: CalendarAppointment & { client_id: string | null; mechanic: { full_name: string } | null };
  closeHref: string;
  state: CalendarState;
  lang: Locale;
  dateLocale: string;
  d: D;
  dictionary: Dictionary;
  mechanics: Mechanic[];
  isOwner: boolean;
}) {
  const formatTime = timeFormatter(lang);
  const start = new Date(appointment.start_time);
  const isOpen = appointment.status === "pending" || appointment.status === "confirmed";
  const service = appointment.services?.name ?? d.serviceFallback;
  const vehicle = appointment.vehicle;
  const vehicleDescription = [vehicle?.brands?.name, vehicle?.model].filter(Boolean).join(" ");
  const plate = vehicle?.license_plate?.trim();
  const statusLabel =
    dictionary.common.appointmentStatus[appointment.status as keyof Dictionary["common"]["appointmentStatus"]] ??
    appointment.status;

  return (
    <DrawerShell closeHref={closeHref} closeLabel={d.close} title={service}>
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600 dark:text-zinc-400">
            <span aria-hidden className={`h-2 w-2 rounded-full ${STATUS_DOT[appointment.status] ?? STATUS_DOT.pending}`} />
            {statusLabel}
          </span>
          <p className="text-lg font-semibold text-black first-letter:uppercase dark:text-zinc-50">
            {start.toLocaleDateString(dateLocale, {
              timeZone: APP_TIME_ZONE,
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <p className="text-sm tabular-nums text-zinc-600 dark:text-zinc-400">
            {formatTime.format(start)}–{formatTime.format(new Date(appointment.end_time))}
          </p>
        </div>

        <dl className="grid grid-cols-[6.5rem_1fr] gap-x-4 gap-y-3 text-sm">
          <dt className="text-zinc-500 dark:text-zinc-400">{d.clientLabel}</dt>
          <dd className="font-medium text-black dark:text-zinc-50">
            {customerName(appointment, d)}
            {appointment.walk_in?.phone && (
              <a
                href={`tel:${appointment.walk_in.phone.replace(/[^\d+]/g, "")}`}
                className="block font-normal text-brand-600 hover:underline dark:text-brand-400"
              >
                {appointment.walk_in.phone}
              </a>
            )}
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">{d.vehicleLabel}</dt>
          <dd className="flex flex-wrap items-center gap-2 text-black dark:text-zinc-50">
            {plate && <LicensePlate plate={plate} label={d.plateLabel} />}
            {vehicleDescription || (!plate && <span className="text-zinc-500">—</span>)}
          </dd>
          <dt className="text-zinc-500 dark:text-zinc-400">{d.mechanicLabel}</dt>
          <dd className="text-black dark:text-zinc-50">{appointment.mechanic?.full_name ?? d.unassigned}</dd>
        </dl>

        {isOwner && isOpen && mechanics.length > 0 && (
          <form action={assignMechanic} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="lang" value={lang} />
            <input type="hidden" name="returnView" value={state.view} />
            <input type="hidden" name="returnDate" value={state.date} />
            {state.cancelled && <input type="hidden" name="returnCancelled" value="1" />}
            <input type="hidden" name="returnBy" value={state.by} />
            <label htmlFor="drawer-mechanic" className="text-sm font-medium">
              {d.reassign}
            </label>
            <div className="flex gap-2">
              <StyledSelect
                id="drawer-mechanic"
                name="mechanicId"
                defaultValue={appointment.assigned_mechanic_id ?? ""}
                className="text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">{d.autoAssign}</option>
                {mechanics.map((mechanic) => (
                  <option key={mechanic.id} value={mechanic.id}>
                    {mechanic.full_name}
                  </option>
                ))}
              </StyledSelect>
              <button type="submit" className={`${DRAWER_BUTTON} shrink-0 py-1.5`}>
                {d.set}
              </button>
            </div>
          </form>
        )}

        {appointment.status === "confirmed" && (
          <form action={updateRepairStage} className="flex flex-col gap-2">
            <input type="hidden" name="id" value={appointment.id} />
            <input type="hidden" name="lang" value={lang} />
            <label htmlFor="drawer-stage" className="text-sm font-medium">
              {d.repairStageLabel}
            </label>
            <div className="flex gap-2">
              <StyledSelect
                id="drawer-stage"
                name="stage"
                defaultValue={appointment.repair_stage ?? ""}
                className="text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="" disabled>
                  {d.repairStagePlaceholder}
                </option>
                {REPAIR_STAGES.map((stage) => (
                  <option key={stage} value={stage}>
                    {dictionary.common.repairStage[stage]}
                  </option>
                ))}
              </StyledSelect>
              <button type="submit" className={`${DRAWER_BUTTON} shrink-0 py-1.5`}>
                {d.update}
              </button>
            </div>
          </form>
        )}

        <div className="flex flex-col gap-2 border-t border-zinc-200 pt-5 dark:border-zinc-800">
          {appointment.status === "pending" && (
            <form action={confirmAppointment}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="w-full rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
              >
                {d.confirm}
              </button>
            </form>
          )}
          {isOpen && (
            <form action={completeAppointment}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="lang" value={lang} />
              <button type="submit" className={`${DRAWER_BUTTON} w-full`}>
                {d.complete}
              </button>
            </form>
          )}
          <div className="grid grid-cols-2 gap-2">
            {appointment.client_id && appointment.profiles && (
              <Link href={`/${lang}/appointments/${appointment.id}/messages`} className={DRAWER_BUTTON}>
                {d.message}
              </Link>
            )}
            {isOpen && (
              <Link href={`/${lang}/appointments/${appointment.id}/reschedule`} className={DRAWER_BUTTON}>
                {d.reschedule}
              </Link>
            )}
          </div>
          {isOpen && (
            <form action={providerCancelAppointment}>
              <input type="hidden" name="id" value={appointment.id} />
              <input type="hidden" name="lang" value={lang} />
              <button
                type="submit"
                className="w-full rounded-full px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                {d.cancel}
              </button>
            </form>
          )}
        </div>
      </div>
    </DrawerShell>
  );
}
