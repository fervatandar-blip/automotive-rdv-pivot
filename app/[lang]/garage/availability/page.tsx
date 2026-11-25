import type { ReactNode } from "react";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  deleteAvailabilityBlock,
  deleteAvailabilityOverride,
  removeClosedDates,
} from "@/app/actions/availability";
import { BlockTimeButton } from "@/components/block-time-modal";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { APP_TIME_ZONE, dateKeyToDisplayDate, todayKeyInAppZone } from "@/lib/timezone";
import { groupConsecutiveDates, weekFormFromWindows } from "@/lib/opening-hours";
import { ClosedDatesForm } from "./closed-dates-form";
import { WeeklyHoursForm } from "./weekly-hours-form";

function Panel({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section
      aria-labelledby={id}
      className="overflow-hidden rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hairline px-4 py-4 sm:px-5">
        <div>
          <h2 id={id} className="text-base font-semibold text-ink">
            {title}
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

const REMOVE_BUTTON =
  "rounded-full px-3 py-1 text-xs font-medium text-ink-muted transition-colors hover:bg-subtle hover:text-ink";

/**
 * Working hours & availability: the weekly schedule (with lunch breaks),
 * holidays / closed dates, and intraday blocked slots -- everything that
 * decides when clients can book (lib/availability.ts).
 */
export default async function GarageAvailabilityPage({
  params,
}: {
  params: Promise<{ lang: string }>;
}) {
  const { lang: rawLang } = await params;
  const lang = resolveLocale(rawLang);
  const { garage } = await requireGarageMember(lang);
  const dictionary = await getDictionary(lang);
  const d = dictionary.garageAvailability;
  const dateLocale = lang === "fr" ? "fr-FR" : "en-GB";
  const supabase = await createClient();
  const todayKey = todayKeyInAppZone();

  const [{ data: availability }, { data: overrides }, { data: blocks }] = await Promise.all([
    supabase
      .from("availability")
      .select("day_of_week, start_time, end_time")
      .eq("garage_id", garage.id),
    supabase
      .from("availability_overrides")
      .select("id, date, is_closed, start_time, end_time")
      .eq("garage_id", garage.id)
      .gte("date", todayKey)
      .order("date", { ascending: true }),
    // Garage-members-only through RLS (0039), reason included.
    supabase
      .from("availability_blocks")
      .select("id, starts_at, ends_at, reason")
      .eq("garage_id", garage.id)
      .gt("ends_at", new Date().toISOString())
      .order("starts_at", { ascending: true }),
  ]);

  const closures = groupConsecutiveDates(
    (overrides ?? []).filter((override) => override.is_closed).map((override) => override.date as string)
  );
  // One-off "special hours" days from before the form only offered
  // closures; still listed so they can be seen and removed.
  const specialHours = (overrides ?? []).filter((override) => !override.is_closed);

  const dayFormatter = new Intl.DateTimeFormat(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const formatDay = (date: string) => dayFormatter.format(dateKeyToDisplayDate(date));
  const timeFormatter = new Intl.DateTimeFormat(dateLocale, {
    timeZone: APP_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div className="flex flex-1 flex-col bg-canvas px-4 py-8 sm:px-8 sm:py-10">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <header>
          <h1 className="text-2xl font-bold tracking-tight text-ink">{d.title}</h1>
          <p className="mt-1 text-sm text-ink-muted">{d.subtitle}</p>
        </header>

        {/* The schedule is the page's main form: plain rows, no card. */}
        <section aria-labelledby="weekly-hours" className="flex flex-col gap-1">
          <div>
            <h2 id="weekly-hours" className="text-base font-semibold text-ink">
              {d.weeklyTitle}
            </h2>
            <p className="mt-0.5 text-sm text-ink-muted">{d.weeklyDescription}</p>
          </div>
          <WeeklyHoursForm lang={lang} d={d} initialDays={weekFormFromWindows(availability ?? [])} />
        </section>

        <Panel id="closed-dates" title={d.closedTitle} description={d.closedDescription}>
          <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
            <ClosedDatesForm lang={lang} d={d} today={todayKey} />
            {closures.length > 0 || specialHours.length > 0 ? (
              <ul className="-mx-4 divide-y divide-hairline border-t border-hairline sm:-mx-5">
                {closures.map((run) => {
                  const days =
                    Math.round(
                      (dateKeyToDisplayDate(run.to).getTime() - dateKeyToDisplayDate(run.from).getTime()) / 86_400_000
                    ) + 1;
                  const label = run.from === run.to ? formatDay(run.from) : `${formatDay(run.from)} – ${formatDay(run.to)}`;
                  return (
                    <li key={run.from} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                      <span className="min-w-0">
                        <span className="font-medium text-ink first-letter:uppercase">{label}</span>
                        <span className="ml-2 text-xs text-ink-muted">
                          {d.closedDays.replace("{count}", String(days))}
                        </span>
                      </span>
                      <form action={removeClosedDates}>
                        <input type="hidden" name="lang" value={lang} />
                        <input type="hidden" name="from" value={run.from} />
                        <input type="hidden" name="to" value={run.to} />
                        <button type="submit" aria-label={`${d.reopen} ${label}`} className={REMOVE_BUTTON}>
                          {d.reopen}
                        </button>
                      </form>
                    </li>
                  );
                })}
                {specialHours.map((override) => (
                  <li key={override.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                    <span>
                      <span className="font-medium text-ink first-letter:uppercase">
                        {formatDay(override.date)}
                      </span>
                      <span className="ml-2 text-xs text-ink-muted">
                        {d.specialHours
                          .replace("{from}", String(override.start_time).slice(0, 5))
                          .replace("{to}", String(override.end_time).slice(0, 5))}
                      </span>
                    </span>
                    <form action={deleteAvailabilityOverride}>
                      <input type="hidden" name="lang" value={lang} />
                      <input type="hidden" name="id" value={override.id} />
                      <button type="submit" className={REMOVE_BUTTON}>
                        {d.remove}
                      </button>
                    </form>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-muted">{d.noClosures}</p>
            )}
          </div>
        </Panel>

        <Panel
          id="blocked-slots"
          title={d.blocksTitle}
          description={d.blocksDescription}
          action={
            <BlockTimeButton lang={lang} d={dictionary.blockTime} label={d.blockTimeButton} today={todayKey} />
          }
        >
          {blocks && blocks.length > 0 ? (
            <ul className="divide-y divide-hairline">
              {blocks.map((block) => {
                const range = `${timeFormatter.format(new Date(block.starts_at))}–${timeFormatter.format(new Date(block.ends_at))}`;
                const date = dayFormatter.format(new Date(block.starts_at));
                return (
                  <li key={block.id} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm sm:px-5">
                    <span className="min-w-0">
                      <span className="font-medium text-ink first-letter:uppercase">
                        {date} · <span className="tabular-nums">{range}</span>
                      </span>
                      {block.reason && (
                        <span className="ml-2 truncate text-xs text-ink-muted">{block.reason}</span>
                      )}
                    </span>
                    <form action={deleteAvailabilityBlock}>
                      <input type="hidden" name="id" value={block.id} />
                      <input type="hidden" name="lang" value={lang} />
                      <button type="submit" aria-label={`${d.remove} ${date} ${range}`} className={REMOVE_BUTTON}>
                        {d.remove}
                      </button>
                    </form>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="px-4 py-4 text-sm text-ink-muted sm:px-5">{d.noUpcomingBlocks}</p>
          )}
        </Panel>
      </div>
    </div>
  );
}
