"use client";

import { useActionState, useId, useState } from "react";
import { Check, Copy, Plus, X } from "lucide-react";
import { saveWeeklyHours } from "@/app/actions/availability";
import type { DayForm } from "@/lib/opening-hours";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type D = Dictionary["garageAvailability"];

const TIME_INPUT =
  "w-[6.25rem] rounded-md border border-transparent bg-zinc-100 px-2 py-1 text-sm tabular-nums text-black transition-colors hover:bg-zinc-200/70 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:bg-zinc-900 dark:text-zinc-50 dark:[color-scheme:dark] dark:hover:bg-zinc-800 dark:focus:border-brand-500 dark:focus:bg-zinc-950";

// Mon-Fri, for "Copy Monday to weekdays".
const WEEKDAYS = [1, 2, 3, 4, 5];

/**
 * The weekly schedule as one form: a row per day (Monday first) with an
 * open/closed switch, opening hours and an optional lunch break. Saved in
 * one transaction (saveWeeklyHours -> set_weekly_availability, 0043).
 */
export function WeeklyHoursForm({
  lang,
  d,
  initialDays,
}: {
  lang: Locale;
  d: D;
  initialDays: DayForm[];
}) {
  const [days, setDays] = useState(initialDays);
  const [dirty, setDirty] = useState(false);
  const [state, action, pending] = useActionState(
    async (previous: Awaited<ReturnType<typeof saveWeeklyHours>>, formData: FormData) => {
      const result = await saveWeeklyHours(previous, formData);
      if (result?.saved) setDirty(false);
      return result;
    },
    undefined
  );
  const id = useId();

  function update(dayOfWeek: number, patch: Partial<DayForm>) {
    setDays((current) => current.map((day) => (day.dayOfWeek === dayOfWeek ? { ...day, ...patch } : day)));
    setDirty(true);
  }

  function copyMondayToWeekdays() {
    const monday = days.find((day) => day.dayOfWeek === 1);
    if (!monday) return;
    setDays((current) =>
      current.map((day) =>
        WEEKDAYS.includes(day.dayOfWeek) && day.dayOfWeek !== 1
          ? { ...monday, dayOfWeek: day.dayOfWeek, extraRanges: false }
          : day
      )
    );
    setDirty(true);
  }

  const dayErrors = state?.dayErrors ?? {};

  return (
    <form action={action} className="flex flex-col">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="week" value={JSON.stringify(days)} />

      <ul className="divide-y divide-zinc-200/80 dark:divide-zinc-800/50">
        {days.map((day) => {
          const label = d.days[day.dayOfWeek];
          const error = dayErrors[day.dayOfWeek];
          const rowId = `${id}-${day.dayOfWeek}`;
          return (
            <li key={day.dayOfWeek} className="flex flex-col gap-1.5 py-3">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2.5 sm:grid sm:min-h-9 sm:grid-cols-[7rem_7.5rem_1fr]">
                <span id={`${rowId}-label`} className="w-24 shrink-0 text-sm font-medium text-black sm:w-auto dark:text-zinc-50">
                  {label}
                </span>

                <button
                  type="button"
                  role="switch"
                  aria-checked={day.open}
                  aria-labelledby={`${rowId}-label`}
                  onClick={() => update(day.dayOfWeek, { open: !day.open })}
                  className="group flex items-center gap-3 rounded-full text-sm focus-visible:outline-none"
                >
                  {/* The track must be a sized box (inline-flex), or the
                      absolutely-positioned thumb escapes onto the label. */}
                  <span
                    aria-hidden
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors group-focus-visible:ring-2 group-focus-visible:ring-brand-600/40 group-focus-visible:ring-offset-2 dark:group-focus-visible:ring-offset-zinc-950 ${
                      day.open ? "bg-brand-600 dark:bg-brand-500" : "bg-zinc-300 dark:bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                        day.open ? "translate-x-[18px]" : "translate-x-0.5"
                      }`}
                    />
                  </span>
                  <span className={day.open ? "text-black dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}>
                    {day.open ? d.open : d.closed}
                  </span>
                </button>

                {day.open && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                    <div className="flex items-center gap-1.5">
                      <input
                        type="time"
                        step={300}
                        value={day.opens}
                        onChange={(event) => update(day.dayOfWeek, { opens: event.target.value })}
                        aria-label={d.opensAt.replace("{day}", label)}
                        className={TIME_INPUT}
                      />
                      <span aria-hidden className="text-zinc-400 dark:text-zinc-600">–</span>
                      <input
                        type="time"
                        step={300}
                        value={day.closes}
                        onChange={(event) => update(day.dayOfWeek, { closes: event.target.value })}
                        aria-label={d.closesAt.replace("{day}", label)}
                        className={TIME_INPUT}
                      />
                    </div>

                    {day.lunch ? (
                      <div className="flex items-center gap-1.5">
                        <span className="mr-0.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">{d.lunchBreak}</span>
                        <input
                          type="time"
                          step={300}
                          value={day.lunchStart}
                          onChange={(event) => update(day.dayOfWeek, { lunchStart: event.target.value })}
                          aria-label={d.lunchStartsAt.replace("{day}", label)}
                          className={TIME_INPUT}
                        />
                        <span aria-hidden className="text-zinc-400 dark:text-zinc-600">–</span>
                        <input
                          type="time"
                          step={300}
                          value={day.lunchEnd}
                          onChange={(event) => update(day.dayOfWeek, { lunchEnd: event.target.value })}
                          aria-label={d.lunchEndsAt.replace("{day}", label)}
                          className={TIME_INPUT}
                        />
                        <button
                          type="button"
                          onClick={() => update(day.dayOfWeek, { lunch: false })}
                          aria-label={d.removeLunchBreak.replace("{day}", label)}
                          className="flex h-7 w-7 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-black dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                        >
                          <X aria-hidden className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => update(day.dayOfWeek, { lunch: true })}
                        aria-label={d.addLunchBreakFor.replace("{day}", label)}
                        className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-2.5 py-1 text-xs font-medium text-zinc-600 transition-colors hover:border-zinc-400 hover:text-black dark:border-zinc-700 dark:text-zinc-400 dark:hover:border-zinc-500 dark:hover:text-zinc-50"
                      >
                        <Plus aria-hidden className="h-3 w-3" />
                        {d.addLunchBreak}
                      </button>
                    )}
                  </div>
                )}
              </div>
              {day.extraRanges && (
                <p className="text-xs text-amber-700 sm:pl-[17.5rem] dark:text-amber-400">{d.extraRangesNotice}</p>
              )}
              {error && (
                <p role="alert" className="text-xs text-red-600 sm:pl-[17.5rem] dark:text-red-400">
                  {d.dayErrors[error]}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/50">
        <button
          type="button"
          onClick={copyMondayToWeekdays}
          className="inline-flex items-center gap-1.5 rounded-full border border-zinc-200 px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
        >
          <Copy aria-hidden className="h-3.5 w-3.5" />
          {d.copyMonday}
        </button>
        <div className="flex items-center gap-3">
          <span aria-live="polite" className="text-sm">
            {state?.message ? (
              <span className="text-red-600 dark:text-red-400">{d.errors[state.message]}</span>
            ) : dirty ? (
              <span className="text-zinc-500 dark:text-zinc-400">{d.unsaved}</span>
            ) : state?.saved ? (
              <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
                <Check aria-hidden className="h-4 w-4" />
                {d.saved}
              </span>
            ) : null}
          </span>
          <button
            type="submit"
            disabled={pending || !dirty}
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            {pending ? d.saving : d.saveHours}
          </button>
        </div>
      </div>
    </form>
  );
}
