import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { LucideIcon } from "lucide-react";
import { ArrowRight, CalendarClock, CalendarPlus, Car, ChevronRight, Hourglass, MessageSquare, Star } from "lucide-react";
import { getAuthedProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { logout } from "@/app/actions/auth";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "@/components/language-switcher";
import { LicensePlate } from "@/components/license-plate";
import { getClientUnreadCounts, totalUnread } from "@/lib/unread-messages";
import { loadClientAppointments, loadClientWaitlist, type ClientAppointment } from "@/lib/client-appointments";
import {
  DateBlock,
  RepairStageTrack,
  StatusLabel,
  UpcomingActions,
  VehicleTag,
  TimeTag,
  WorkshopLine,
  dateLocaleFor,
  formatLongDate,
  formatTime,
} from "@/components/client-appointment-parts";
import {
  CLIENT_DIVIDE,
  CLIENT_FIT_PAGE,
  CLIENT_PAGE_SUBTITLE,
  CLIENT_PAGE_TITLE,
  CLIENT_PRIMARY_BUTTON,
  CLIENT_ROW_HOVER,
  CLIENT_SECTION_LABEL,
  CLIENT_SURFACE,
  CLIENT_SURFACE_HEADER,
  CLIENT_TEXT_LINK,
  CLIENT_TINTED_PILL,
} from "@/lib/client-ui";
import { APP_TIME_ZONE } from "@/lib/timezone";

// Upcoming visits listed under the next one; the rest live on Appointments.
const MAX_FOLLOWING = 2;

type VehicleRow = {
  id: string;
  model: string | null;
  year: number | null;
  license_plate: string | null;
  vin: string | null;
  brands: { name: string } | null;
};

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const { clientNav } = await getDictionary(resolveLocale(lang));
  return { title: clientNav.dashboard };
}

function shortDate(iso: string, lang: Locale, withYear = false) {
  return new Date(iso).toLocaleDateString(dateLocaleFor(lang), {
    timeZone: APP_TIME_ZONE,
    day: "2-digit",
    month: "short",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/** The next visit, in full: when, what, where, which car, repair progress. */
function NextAppointment({
  appointment,
  following,
  moreCount,
  lang,
  dictionary,
}: {
  appointment: ClientAppointment | undefined;
  following: ClientAppointment[];
  moreCount: number;
  lang: Locale;
  dictionary: Dictionary;
}) {
  const d = dictionary.clientDashboard;

  return (
    <section aria-labelledby="next-title" className={`${CLIENT_SURFACE} flex flex-col overflow-hidden`}>
      <div className={CLIENT_SURFACE_HEADER}>
        <h2 id="next-title" className={CLIENT_SECTION_LABEL}>
          {d.nextAppointment}
        </h2>
        <Link href={`/${lang}/appointments`} className={CLIENT_TEXT_LINK}>
          {d.allAppointments}
          <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
        </Link>
      </div>

      {appointment ? (
        <>
          <div className="flex flex-col gap-5 p-5 sm:p-6">
            <div className="flex items-start gap-4 sm:gap-5">
              <DateBlock iso={appointment.start_time} lang={lang} size="lg" />
              <div className="flex min-w-0 flex-1 flex-col gap-1">
                <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-muted">
                  <span className="font-semibold capitalize text-ink">{formatLongDate(appointment.start_time, lang)}</span>
                  <TimeTag iso={appointment.start_time} lang={lang} />
                </p>
                <h3 className="truncate text-xl font-bold tracking-tight text-ink sm:text-2xl">
                  {appointment.services?.name ?? d.serviceFallback}
                </h3>
                <p className="mt-1 flex min-w-0 text-sm">
                  <WorkshopLine appointment={appointment} d={d} />
                </p>
              </div>
              <StatusLabel status={appointment.status} d={d} />
            </div>

            <VehicleTag vehicle={appointment.vehicles} plateLabel={d.plateLabel} />

            <RepairStageTrack stage={appointment.repair_stage} labels={dictionary.common.repairStage} />

            <div className="border-t border-hairline pt-4">
              <UpcomingActions appointment={appointment} lang={lang} d={d} />
            </div>
          </div>

          {following.length > 0 && (
            <ul className={`border-t border-hairline ${CLIENT_DIVIDE}`}>
              {following.map((upcoming) => (
                <li key={upcoming.id}>
                  <Link
                    href={`/${lang}/appointments`}
                    className={`flex items-center gap-4 px-5 py-3.5 text-sm sm:px-6 ${CLIENT_ROW_HOVER}`}
                  >
                    <span className="w-32 shrink-0 font-mono text-xs font-medium text-ink-muted">
                      {shortDate(upcoming.start_time, lang)} {formatTime(upcoming.start_time, lang)}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-medium text-ink">
                      {upcoming.services?.name ?? d.serviceFallback}
                    </span>
                    <span className="hidden min-w-0 max-w-[40%] truncate text-ink-muted sm:block">
                      {upcoming.garages?.name ?? d.garageFallback}
                    </span>
                  </Link>
                </li>
              ))}
              {moreCount > 0 && (
                <li className="px-5 py-3 sm:px-6">
                  <Link href={`/${lang}/appointments`} className={CLIENT_TEXT_LINK}>
                    {d.moreUpcoming.replace("{count}", String(moreCount))}
                    <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
                  </Link>
                </li>
              )}
            </ul>
          )}
        </>
      ) : (
        <div className="flex flex-col items-start gap-3 p-6">
          <p className="text-lg font-bold tracking-tight text-ink">{d.noUpcomingTitle}</p>
          <p className="max-w-sm text-sm text-ink-muted">{d.noUpcomingDescription}</p>
          <Link href={`/${lang}/garages`} className={`${CLIENT_PRIMARY_BUTTON} mt-1`}>
            {d.findServiceCenter}
            <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
          </Link>
        </div>
      )}
    </section>
  );
}

function QuickAction({
  href,
  icon: Icon,
  label,
  detail,
  highlight = false,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  detail?: string;
  highlight?: boolean;
}) {
  return (
    <li>
      <Link href={href} className={`flex items-center gap-3 px-5 py-3.5 text-sm sm:px-6 ${CLIENT_ROW_HOVER}`}>
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-subtle">
          <Icon aria-hidden className="h-4 w-4 text-ink" strokeWidth={1.75} />
        </span>
        <span className="min-w-0 flex-1 truncate font-semibold text-ink">{label}</span>
        {detail && (
          <span
            className={`max-w-[55%] shrink-0 truncate text-xs ${
              highlight ? "font-medium text-amber-700 dark:text-amber-300" : "text-ink-muted"
            }`}
          >
            {detail}
          </span>
        )}
        <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-ink-muted" strokeWidth={1.75} />
      </Link>
    </li>
  );
}

export default async function DashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ booked?: string; rescheduled?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.clientDashboard;
  const v = dictionary.vehicles;
  const profile = await getAuthedProfile(lang);

  if (profile.role === "admin_garage" || profile.role === "mecanicien") {
    redirect(`/${lang}/garage/dashboard`);
  }

  if (profile.role === "super_admin") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-canvas px-4 py-16">
        <div className={`${CLIENT_SURFACE} flex w-full max-w-sm flex-col gap-4 p-8`}>
          <h1 className="text-2xl font-semibold text-ink">
            {d.welcomePrefix} {profile.full_name || profile.email}
          </h1>
          <p className="text-sm text-ink-muted">
            {d.rolePrefix} {profile.role}
          </p>
          <div className="flex gap-4 text-sm font-medium underline">
            <Link href={`/${lang}/admin/stats`}>{d.overview}</Link>
            <Link href={`/${lang}/admin/garages`}>{d.garagesNav}</Link>
            <Link href={`/${lang}/admin/leads`}>{d.leadsNav}</Link>
          </div>
          <Link href={`/${lang}/account`} className="text-sm font-medium underline">
            {d.account}
          </Link>
          <LanguageSwitcher lang={lang} />
          <form action={logout}>
            <input type="hidden" name="lang" value={lang} />
            <button type="submit" className={CLIENT_TINTED_PILL}>
              {d.logOut}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const { booked, rescheduled } = await searchParams;
  const supabase = await createClient();

  const [{ upcoming, past, reviewed }, waitlist, { data: vehicleRows }, unreadCounts] = await Promise.all([
    loadClientAppointments(supabase, profile.id),
    loadClientWaitlist(supabase, profile.id),
    supabase
      .from("vehicles")
      .select("id, model, year, license_plate, vin, brands(name)")
      .eq("client_id", profile.id)
      .order("created_at", { ascending: false }),
    getClientUnreadCounts(supabase),
  ]);

  const vehicles = (vehicleRows ?? []) as unknown as VehicleRow[];
  const [next, ...rest] = upcoming;
  const following = rest.slice(0, MAX_FOLLOWING);
  const moreCount = rest.length - following.length;

  // The car the client deals with now: the one booked next, else the most
  // recently added.
  const activeVehicle = vehicles.find((vehicle) => vehicle.id === next?.vehicles?.id) ?? vehicles[0];
  const activeVehicleName =
    activeVehicle && ([activeVehicle.brands?.name, activeVehicle.model].filter(Boolean).join(" ") || v.vehicleFallback);
  const lastVisit = activeVehicle
    ? past.find((row) => row.status === "completed" && row.vehicles?.id === activeVehicle.id)
    : undefined;

  const unread = totalUnread(unreadCounts);
  const toReview = past.filter((row) => row.status === "completed" && !reviewed.has(row.id)).length;
  const slotOpened = waitlist.some((entry) => entry.notified_at);
  const firstName = (profile.full_name || "").trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString(dateLocaleFor(lang), {
    timeZone: APP_TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const flash = booked === "1" ? d.appointmentBooked : rescheduled === "1" ? d.appointmentRescheduled : null;

  return (
    <div className={CLIENT_FIT_PAGE}>
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className={CLIENT_PAGE_TITLE}>
              {firstName ? `${d.welcomePrefix} ${firstName}` : d.welcomeFallback}
            </h1>
            <p className={`${CLIENT_PAGE_SUBTITLE} first-letter:uppercase`}>{today}</p>
          </div>
          <Link href={`/${lang}/garages`} className={CLIENT_PRIMARY_BUTTON}>
            <CalendarPlus aria-hidden className="h-4 w-4" strokeWidth={2} />
            {d.bookAppointment}
          </Link>
        </header>

        {flash && (
          <p
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300"
          >
            {flash}
          </p>
        )}

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <NextAppointment
            appointment={next}
            following={following}
            moreCount={moreCount}
            lang={lang}
            dictionary={dictionary}
          />

          <aside className={`${CLIENT_SURFACE} flex flex-col overflow-hidden`}>
            <div className={CLIENT_SURFACE_HEADER}>
              <h2 className={CLIENT_SECTION_LABEL}>{d.yourVehicle}</h2>
              <Link href={`/${lang}/vehicles`} className={CLIENT_TEXT_LINK}>
                {d.manageVehicles}
                <ChevronRight aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </div>

            {activeVehicle ? (
              <div className="flex flex-col gap-4 px-5 py-5 sm:px-6">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg font-bold tracking-[-0.02em] text-ink">
                      {activeVehicleName}
                    </p>
                    {activeVehicle.year && <p className="font-mono text-xs text-ink-muted">{activeVehicle.year}</p>}
                  </div>
                  {activeVehicle.license_plate?.trim() && (
                    <LicensePlate plate={activeVehicle.license_plate.trim()} label={d.plateLabel} />
                  )}
                </div>
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 text-sm">
                  {activeVehicle.vin && (
                    <>
                      <dt className="text-ink-muted">{v.vinLabel}</dt>
                      <dd className="truncate text-right font-mono text-ink">{activeVehicle.vin}</dd>
                    </>
                  )}
                  <dt className="text-ink-muted">{d.lastVisit}</dt>
                  <dd className="truncate text-right">
                    {lastVisit ? (
                      <span className="font-mono text-ink">{shortDate(lastVisit.start_time, lang, true)}</span>
                    ) : (
                      <span className="text-ink-muted">{d.noRecentService}</span>
                    )}
                  </dd>
                </dl>
                <Link
                  href={`/${lang}/garages?vehicle=${activeVehicle.id}`}
                  aria-label={v.bookServiceFor.replace("{vehicle}", activeVehicleName ?? v.vehicleFallback)}
                  className={`${CLIENT_TINTED_PILL} justify-center`}
                >
                  <CalendarPlus aria-hidden className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
                  {v.bookService}
                </Link>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-2 px-5 py-5 sm:px-6">
                <p className="text-base font-bold tracking-tight text-ink">{d.noVehicleTitle}</p>
                <p className="text-sm text-ink-muted">{d.noVehiclesHint}</p>
                <Link href={`/${lang}/vehicles`} className={`${CLIENT_TINTED_PILL} mt-1`}>
                  <Car aria-hidden className="h-4 w-4 text-ink-muted" strokeWidth={1.75} />
                  {v.addVehicleButton}
                </Link>
              </div>
            )}

            <h2 className={`border-y border-hairline px-5 py-3 sm:px-6 ${CLIENT_SECTION_LABEL}`}>{d.quickActions}</h2>
            <ul className={CLIENT_DIVIDE}>
              <QuickAction
                href={`/${lang}/messages`}
                icon={MessageSquare}
                label={dictionary.clientNav.messages}
                detail={unread > 0 ? d.unreadMessages.replace("{count}", String(unread)) : undefined}
              />
              <QuickAction
                href={`/${lang}/appointments?tab=past`}
                icon={Star}
                label={d.leaveAReview}
                detail={
                  toReview === 0
                    ? undefined
                    : toReview === 1
                      ? d.reviewPendingOne
                      : d.reviewPendingMany.replace("{count}", String(toReview))
                }
              />
              <QuickAction
                href={`/${lang}/appointments?tab=waitlist`}
                icon={Hourglass}
                label={d.waitlist}
                detail={
                  slotOpened
                    ? d.waitlistSlotOpenedShort
                    : waitlist.length > 0
                      ? d.waitlistActive.replace("{count}", String(waitlist.length))
                      : undefined
                }
                highlight={slotOpened}
              />
              <QuickAction href={`/${lang}/appointments?tab=past`} icon={CalendarClock} label={d.pastServiceHistory} />
            </ul>
          </aside>
        </div>
      </div>
    </div>
  );
}
