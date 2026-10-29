import Link from "next/link";
import { requireGarageMember } from "@/lib/dal";
import { createClient } from "@/lib/supabase/server";
import {
  deleteAvailability,
  deleteAvailabilityOverride,
} from "@/app/actions/availability";
import { resolveLocale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { LanguageSwitcher } from "@/components/language-switcher";
import { AddAvailabilityForm } from "./add-availability-form";
import { AddOverrideForm } from "./add-override-form";
import { APP_TIME_ZONE, dateKeyToDisplayDate, todayKeyInAppZone } from "@/lib/timezone";
import { WEEK_ORDER } from "@/lib/opening-hours";

function formatTime(time: string) {
  return time.slice(0, 5);
}

function formatOverrideDate(date: string, dateLocale: string) {
  return dateKeyToDisplayDate(date).toLocaleDateString(dateLocale, {
    timeZone: APP_TIME_ZONE,
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
  const dateLocale = lang === "fr" ? "fr-FR" : "en-US";
  const supabase = await createClient();

  const { data: availability } = await supabase
    .from("availability")
    .select("id, day_of_week, start_time, end_time")
    .eq("garage_id", garage.id)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });

  const byDay = d.days.map((_: string, dayOfWeek: number) =>
    (availability ?? []).filter((slot) => slot.day_of_week === dayOfWeek)
  );

  const { data: overrides } = await supabase
    .from("availability_overrides")
    .select("id, date, is_closed, start_time, end_time")
    .eq("garage_id", garage.id)
    .gte("date", todayKeyInAppZone())
    .order("date", { ascending: true });

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {garage.name} &mdash; {d.availabilitySuffix}
          </h1>
          <div className="flex items-center gap-4 text-sm font-medium">
            <div className="flex gap-4 underline">
              <Link href={`/${lang}/garage/calendar`}>{d.calendar}</Link>
              <Link href={`/${lang}/garage/services`}>
                {d.manageServices}
              </Link>
            </div>
            <LanguageSwitcher lang={lang} />
          </div>
        </div>

        <AddAvailabilityForm dictionary={d.addForm} days={d.days} />

        <section aria-labelledby="weekly-hours-title" className="flex flex-col gap-3">
          <h2 id="weekly-hours-title" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {d.weeklyScheduleTitle}
          </h2>
          <div className="divide-y divide-black/[.06] rounded-xl border border-black/[.08] bg-white dark:divide-white/[.1] dark:border-white/[.145] dark:bg-zinc-950">
            {WEEK_ORDER.map((dayOfWeek) => {
              const windows = byDay[dayOfWeek];
              return (
                <div
                  key={dayOfWeek}
                  className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-start sm:gap-6 sm:px-6"
                >
                  <h3 className="w-28 shrink-0 pt-0.5 text-sm font-semibold text-black dark:text-zinc-50">
                    {d.days[dayOfWeek]}
                  </h3>
                  {windows.length === 0 ? (
                    <p className="pt-0.5 text-sm text-zinc-500 dark:text-zinc-400">{d.closed}</p>
                  ) : (
                    <ul className="flex flex-1 flex-col gap-1.5">
                      {windows.map((slot, index) => (
                        <li key={slot.id} className="flex flex-col gap-1.5">
                          {index > 0 && (
                            <span className="text-xs text-zinc-500 dark:text-zinc-400">
                              {d.breakLabel.replace(
                                "{range}",
                                `${formatTime(windows[index - 1].end_time)}–${formatTime(slot.start_time)}`
                              )}
                            </span>
                          )}
                          <div className="flex items-center justify-between gap-3 text-sm">
                            <span className="font-medium tabular-nums text-black dark:text-zinc-50">
                              {formatTime(slot.start_time)}–{formatTime(slot.end_time)}
                            </span>
                            <form action={deleteAvailability}>
                              <input type="hidden" name="id" value={slot.id} />
                              <input type="hidden" name="lang" value={lang} />
                              <button
                                type="submit"
                                aria-label={`${d.delete} ${d.days[dayOfWeek]} ${formatTime(slot.start_time)}–${formatTime(slot.end_time)}`}
                                className="text-sm text-red-600 underline"
                              >
                                {d.delete}
                              </button>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <AddOverrideForm dictionary={d.overrideForm} />

        <div className="flex flex-col gap-3">
          <h2 className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {d.upcomingOverrides}
          </h2>
          {overrides && overrides.length > 0 ? (
            overrides.map((override) => (
              <div
                key={override.id}
                className="flex items-center justify-between rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div>
                  <p className="font-medium text-black dark:text-zinc-50">
                    {formatOverrideDate(override.date, dateLocale)}
                  </p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {override.is_closed
                      ? d.closedAllDay
                      : `${formatTime(override.start_time)} – ${formatTime(override.end_time)}`}
                  </p>
                </div>
                <form action={deleteAvailabilityOverride}>
                  <input type="hidden" name="id" value={override.id} />
                  <input type="hidden" name="lang" value={lang} />
                  <button type="submit" className="text-red-600 underline">
                    {d.delete}
                  </button>
                </form>
              </div>
            ))
          ) : (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              {d.noUpcomingOverrides}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
