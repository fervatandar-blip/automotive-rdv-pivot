import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BellRing, CalendarPlus, Wrench } from "lucide-react";
import { getAuthedProfile } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveLocale, type Locale } from "@/lib/i18n/config";
import { getDictionary, type Dictionary } from "@/lib/i18n/get-dictionary";
import { leaveWaitlist } from "@/app/actions/waitlist";
import { REVIEWS_ENABLED } from "@/lib/features";
import { dateKeyToDisplayDate } from "@/lib/timezone";
import {
  loadClientAppointments,
  loadClientWaitlist,
  loadInvoiceUrls,
  type ClientAppointment,
  type ClientWaitlistEntry,
} from "@/lib/client-appointments";
import {
  DateBlock,
  PastActions,
  RepairStageText,
  ReviewForm,
  StatusLabel,
  TimeTag,
  UpcomingActions,
  VehicleTag,
  WorkshopLine,
} from "@/components/client-appointment-parts";
import {
  CLIENT_CARD,
  CLIENT_CARD_PAD,
  CLIENT_CARD_TITLE,
  CLIENT_DANGER_PILL,
  CLIENT_FIT_PAGE,
  CLIENT_PAGE_SUBTITLE,
  CLIENT_PAGE_TITLE,
  CLIENT_PRIMARY_BUTTON,
  CLIENT_SEGMENT,
  CLIENT_SEGMENTED,
  CLIENT_SEGMENT_ACTIVE,
  CLIENT_SEGMENT_IDLE,
} from "@/lib/client-ui";

const TABS = ["upcoming", "past", "waitlist"] as const;
type Tab = (typeof TABS)[number];

function parseTab(value: string | undefined): Tab {
  return TABS.includes(value as Tab) ? (value as Tab) : "upcoming";
}

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }): Promise<Metadata> {
  const { lang } = await params;
  const { clientAppointments } = await getDictionary(resolveLocale(lang));
  return { title: clientAppointments.title };
}

function UpcomingCard({
  appointment,
  lang,
  dictionary,
}: {
  appointment: ClientAppointment;
  lang: Locale;
  dictionary: Dictionary;
}) {
  const d = dictionary.clientDashboard;
  return (
    <li className={`${CLIENT_CARD} ${CLIENT_CARD_PAD} flex flex-col gap-5`}>
      <div className="flex items-start gap-4 sm:gap-5">
        <DateBlock iso={appointment.start_time} lang={lang} size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-2.5">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <h3 className={`${CLIENT_CARD_TITLE} min-w-0 truncate`}>
              {appointment.services?.name ?? d.serviceFallback}
            </h3>
            <StatusLabel status={appointment.status} d={d} />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <TimeTag iso={appointment.start_time} lang={lang} />
            <WorkshopLine appointment={appointment} d={d} />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <VehicleTag vehicle={appointment.vehicles} plateLabel={d.plateLabel} />
            <RepairStageText stage={appointment.repair_stage} labels={dictionary.common.repairStage} />
          </div>
        </div>
      </div>
      <div className="border-t border-hairline pt-4">
        <UpcomingActions appointment={appointment} lang={lang} d={d} />
      </div>
    </li>
  );
}

function PastCard({
  appointment,
  lang,
  dictionary,
  invoiceUrl,
  reviewable,
}: {
  appointment: ClientAppointment;
  lang: Locale;
  dictionary: Dictionary;
  invoiceUrl?: string;
  reviewable: boolean;
}) {
  const d = dictionary.clientDashboard;
  return (
    <li className={`${CLIENT_CARD} ${CLIENT_CARD_PAD} flex flex-col gap-4`}>
      <div className="flex items-start gap-4 sm:gap-5">
        <DateBlock iso={appointment.start_time} lang={lang} tone="past" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
            <h3 className="min-w-0 truncate text-base font-bold tracking-tight text-ink">
              {appointment.services?.name ?? d.serviceFallback}
            </h3>
            <StatusLabel status={appointment.status} d={d} />
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
            <WorkshopLine appointment={appointment} d={d} />
            <VehicleTag vehicle={appointment.vehicles} plateLabel={d.plateLabel} />
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-3 border-t border-hairline pt-4">
        <PastActions appointment={appointment} lang={lang} d={d} invoiceUrl={invoiceUrl} />
        {reviewable && (
          <ReviewForm appointmentId={appointment.id} lang={lang} d={d} label={dictionary.clientAppointments.review} />
        )}
      </div>
    </li>
  );
}

function WaitlistCard({ entry, lang, d }: { entry: ClientWaitlistEntry; lang: Locale; d: Dictionary["clientDashboard"] }) {
  const day = dateKeyToDisplayDate(entry.date).toISOString();
  return (
    <li className={`${CLIENT_CARD} ${CLIENT_CARD_PAD} flex items-center gap-4 sm:gap-5`}>
      <DateBlock iso={day} lang={lang} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <p className="truncate text-base font-bold tracking-tight text-ink">{entry.services?.name ?? d.serviceFallback}</p>
        <p className="inline-flex items-center gap-1.5 truncate text-sm text-ink-muted">
          <Wrench aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {entry.garages?.name ?? d.garageFallback}
        </p>
        {entry.notified_at && (
          <p className="mt-1 inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
            <BellRing aria-hidden className="h-4 w-4 shrink-0" strokeWidth={1.75} />
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
  );
}

function EmptyState({ text, hint, cta }: { text: string; hint?: string; cta?: { href: string; label: string } }) {
  return (
    <div className={`${CLIENT_CARD} flex flex-col items-center justify-center gap-2 px-6 py-14 text-center`}>
      <p className="text-lg font-bold tracking-tight text-ink">{text}</p>
      {hint && <p className="max-w-md text-sm text-ink-muted">{hint}</p>}
      {cta && (
        <Link href={cta.href} className={`${CLIENT_PRIMARY_BUTTON} mt-3`}>
          {cta.label}
          <ArrowRight aria-hidden className="h-4 w-4" strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}

export default async function AppointmentsPage({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ tab?: string; reviewError?: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const profile = await getAuthedProfile(lang);
  if (profile.role === "admin_garage" || profile.role === "mecanicien") {
    redirect(`/${lang}/garage/calendar`);
  }

  const dictionary = await getDictionary(lang);
  const d = dictionary.clientDashboard;
  const t = dictionary.clientAppointments;
  const { tab: rawTab, reviewError } = await searchParams;
  const tab = parseTab(rawTab);
  const supabase = await createClient();

  const [{ upcoming, past, reviewed, completedIds }, waitlist] = await Promise.all([
    loadClientAppointments(supabase, profile.id),
    loadClientWaitlist(supabase, profile.id),
  ]);
  // Signing invoice links costs a storage call: only for the tab showing them.
  const invoiceUrls = tab === "past" ? await loadInvoiceUrls(supabase, completedIds) : new Map<string, string>();

  const counts: Record<Tab, number> = { upcoming: upcoming.length, past: past.length, waitlist: waitlist.length };
  const tabLabel: Record<Tab, string> = { upcoming: t.tabUpcoming, past: t.tabPast, waitlist: t.tabWaitlist };

  return (
    <div className={CLIENT_FIT_PAGE}>
      <div className="mx-auto flex min-h-0 w-full max-w-5xl flex-1 flex-col gap-5">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1">
            <h1 className={CLIENT_PAGE_TITLE}>{t.title}</h1>
            <p className={CLIENT_PAGE_SUBTITLE}>{t.subtitle}</p>
          </div>
          <Link href={`/${lang}/garages`} className={CLIENT_PRIMARY_BUTTON}>
            <CalendarPlus aria-hidden className="h-4 w-4" strokeWidth={2} />
            {d.bookAppointment}
          </Link>
        </header>

        {reviewError && (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300"
          >
            {reviewError === "duplicate" ? d.reviewErrorDuplicate : d.reviewErrorGeneric}
          </p>
        )}

        {/* Tabs are links: each view has its own URL, works without JS
            and survives a reload. */}
        <nav aria-label={t.views} className={`${CLIENT_SEGMENTED} shrink-0 self-start`}>
          {TABS.map((key) => {
            const active = key === tab;
            return (
              <Link
                key={key}
                href={key === "upcoming" ? `/${lang}/appointments` : `/${lang}/appointments?tab=${key}`}
                aria-current={active ? "page" : undefined}
                scroll={false}
                className={`${CLIENT_SEGMENT} ${active ? CLIENT_SEGMENT_ACTIVE : CLIENT_SEGMENT_IDLE}`}
              >
                {tabLabel[key]}
                <span
                  className={`rounded-md px-1.5 py-0.5 tabular-nums text-xs ${
                    active ? "bg-surface/15 text-surface" : "bg-subtle text-ink-muted"
                  }`}
                >
                  {counts[key]}
                </span>
              </Link>
            );
          })}
        </nav>

        {/* The cards scroll here; the side padding keeps their shadow from
            being clipped by the scroll box. */}
        <div className="-mx-2 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
          {tab === "upcoming" &&
            (upcoming.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {upcoming.map((appointment) => (
                  <UpcomingCard key={appointment.id} appointment={appointment} lang={lang} dictionary={dictionary} />
                ))}
              </ul>
            ) : (
              <EmptyState
                text={t.emptyUpcoming}
                hint={d.noUpcomingDescription}
                cta={{ href: `/${lang}/garages`, label: d.findServiceCenter }}
              />
            ))}

          {tab === "past" &&
            (past.length > 0 ? (
              <ol className="flex flex-col gap-3">
                {past.map((appointment) => (
                  <PastCard
                    key={appointment.id}
                    appointment={appointment}
                    lang={lang}
                    dictionary={dictionary}
                    invoiceUrl={invoiceUrls.get(appointment.id)}
                    reviewable={REVIEWS_ENABLED && appointment.status === "completed" && !reviewed.has(appointment.id)}
                  />
                ))}
              </ol>
            ) : (
              <EmptyState text={t.emptyPast} />
            ))}

          {tab === "waitlist" &&
            (waitlist.length > 0 ? (
              <ul className="flex flex-col gap-3">
                {waitlist.map((entry) => (
                  <WaitlistCard key={entry.id} entry={entry} lang={lang} d={d} />
                ))}
              </ul>
            ) : (
              <EmptyState text={t.emptyWaitlist} hint={t.emptyWaitlistHint} />
            ))}
        </div>
      </div>
    </div>
  );
}
