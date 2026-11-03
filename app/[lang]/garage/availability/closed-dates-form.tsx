"use client";

import { useActionState, useId } from "react";
import { AlertTriangle, Check } from "lucide-react";
import { addClosedDates, type ClosedDatesState } from "@/app/actions/availability";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type D = Dictionary["garageAvailability"];

const DATE_INPUT =
  "rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-sm dark:border-zinc-800 dark:bg-zinc-950";

/**
 * Close the garage for a date or a range (holidays, a summer break). "To"
 * is optional: leave it empty for a single day. Existing bookings are
 * kept; the result says how many fall in the closure so they can be moved.
 */
export function ClosedDatesForm({ lang, d, today }: { lang: Locale; d: D; today: string }) {
  const [state, action, pending] = useActionState<ClosedDatesState, FormData>(addClosedDates, undefined);
  const id = useId();
  const errors = state?.errors ?? {};
  const fieldError = (keys?: string[]) =>
    keys?.length ? d.errors[keys[0] as keyof D["errors"]] ?? keys[0] : null;

  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="lang" value={lang} />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-from`} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {d.closedFrom}
          </label>
          <input
            id={`${id}-from`}
            name="from"
            type="date"
            required
            min={today}
            defaultValue={state?.values?.from}
            className={DATE_INPUT}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-to`} className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
            {d.closedTo}
          </label>
          <input
            id={`${id}-to`}
            name="to"
            type="date"
            min={today}
            defaultValue={state?.values?.to}
            aria-describedby={`${id}-to-hint`}
            className={DATE_INPUT}
          />
        </div>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {pending ? d.saving : d.addClosure}
        </button>
      </div>
      <p id={`${id}-to-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">
        {d.closedToHint}
      </p>
      {(fieldError(errors.from) || fieldError(errors.to)) && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {fieldError(errors.from) ?? fieldError(errors.to)}
        </p>
      )}
      {state?.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {d.errors[state.message]}
        </p>
      )}
      {state?.added && (
        <div role="status" className="flex flex-col gap-1.5 text-sm">
          <p className="flex items-center gap-1.5 text-green-700 dark:text-green-400">
            <Check aria-hidden className="h-4 w-4" />
            {d.closureAdded.replace("{count}", String(state.added.days))}
          </p>
          {state.added.overlapping > 0 && (
            <p className="flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" />
              {d.closureOverlap.replace("{count}", String(state.added.overlapping))}
            </p>
          )}
        </div>
      )}
    </form>
  );
}
