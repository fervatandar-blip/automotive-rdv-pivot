"use client";

import { useParams } from "next/navigation";
import { useActionState, useState } from "react";
import { Check } from "lucide-react";
import { createAvailability } from "@/app/actions/availability";
import { WEEK_ORDER } from "@/lib/opening-hours";

type AddAvailabilityFormDictionary = {
  title: string;
  description: string;
  daysLabel: string;
  weekdays: string;
  everyDay: string;
  clear: string;
  startLabel: string;
  endLabel: string;
  submit: string;
  submitPending: string;
  added: string;
  conflict: string;
};

const WEEKDAYS = [1, 2, 3, 4, 5];

export function AddAvailabilityForm({
  dictionary: d,
  days,
}: {
  dictionary: AddAvailabilityFormDictionary;
  days: string[];
}) {
  const [state, action, pending] = useActionState(createAvailability, undefined);
  const { lang } = useParams<{ lang: string }>();
  const [selected, setSelected] = useState<number[]>(WEEKDAYS);

  function toggle(day: number) {
    setSelected((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day]
    );
  }

  const conflictNames = (state?.conflictDays ?? []).map((day) => days[day]).join(", ");

  return (
    <form
      action={action}
      className="flex flex-col gap-5 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
    >
      <input type="hidden" name="lang" value={lang} />

      <div>
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">{d.title}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{d.description}</p>
      </div>

      <fieldset aria-labelledby="availability-days-label" className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span id="availability-days-label" className="text-sm font-medium">
            {d.daysLabel}
          </span>
          <div className="flex gap-3 text-xs font-medium">
            <button type="button" onClick={() => setSelected(WEEKDAYS)} className="underline">
              {d.weekdays}
            </button>
            <button type="button" onClick={() => setSelected([...WEEK_ORDER])} className="underline">
              {d.everyDay}
            </button>
            <button type="button" onClick={() => setSelected([])} className="underline">
              {d.clear}
            </button>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {WEEK_ORDER.map((day) => {
            const checked = selected.includes(day);
            return (
              <label
                key={day}
                className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600/40 ${
                  checked
                    ? "border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500"
                    : "border-black/[.08] hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.06]"
                }`}
              >
                <input
                  type="checkbox"
                  name="days"
                  value={day}
                  checked={checked}
                  onChange={() => toggle(day)}
                  className="sr-only"
                />
                {checked && <Check className="h-3.5 w-3.5" strokeWidth={2.5} />}
                {days[day].slice(0, 3)}
              </label>
            );
          })}
        </div>
        {state?.errors?.days && <p className="text-sm text-red-600">{state.errors.days[0]}</p>}
      </fieldset>

      <div className="grid grid-cols-2 gap-4 sm:max-w-sm">
        <div className="flex flex-col gap-1">
          <label htmlFor="startTime" className="text-sm font-medium">
            {d.startLabel}
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue="08:00"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.startTime && (
            <p className="text-sm text-red-600">{state.errors.startTime[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="endTime" className="text-sm font-medium">
            {d.endLabel}
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue="12:00"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.endTime && (
            <p className="text-sm text-red-600">{state.errors.endTime[0]}</p>
          )}
        </div>
      </div>

      {!pending && conflictNames && (
        <p role="alert" className="text-sm text-red-600">
          {d.conflict.replace("{days}", conflictNames)}
        </p>
      )}
      {!pending && state?.message && (
        <p role="alert" className="text-sm text-red-600">
          {state.message}
        </p>
      )}
      {!pending && state?.added && (
        <p role="status" className="text-sm text-green-700 dark:text-green-500">
          {d.added.replace("{count}", String(state.added))}
        </p>
      )}

      <button
        disabled={pending || selected.length === 0}
        type="submit"
        className="self-start rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
      >
        {pending ? d.submitPending : d.submit}
      </button>
    </form>
  );
}
