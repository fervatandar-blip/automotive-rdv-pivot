"use client";

import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { createAvailability } from "@/app/actions/availability";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function AddAvailabilityForm() {
  const [state, action, pending] = useActionState(
    createAvailability,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { lang } = useParams<{ lang: string }>();

  useEffect(() => {
    if (!pending && !state?.errors && !state?.message) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
    >
      <input type="hidden" name="lang" value={lang} />

      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        Add availability
      </h2>

      <div className="grid grid-cols-3 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="dayOfWeek" className="text-sm font-medium">
            Day
          </label>
          <select
            id="dayOfWeek"
            name="dayOfWeek"
            defaultValue="1"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          >
            {DAYS.map((day, index) => (
              <option key={day} value={index}>
                {day}
              </option>
            ))}
          </select>
          {state?.errors?.dayOfWeek && (
            <p className="text-sm text-red-600">{state.errors.dayOfWeek[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="startTime" className="text-sm font-medium">
            Start
          </label>
          <input
            id="startTime"
            name="startTime"
            type="time"
            defaultValue="09:00"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.startTime && (
            <p className="text-sm text-red-600">{state.errors.startTime[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="endTime" className="text-sm font-medium">
            End
          </label>
          <input
            id="endTime"
            name="endTime"
            type="time"
            defaultValue="17:00"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.endTime && (
            <p className="text-sm text-red-600">{state.errors.endTime[0]}</p>
          )}
        </div>
      </div>

      {state?.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      <button
        disabled={pending}
        type="submit"
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {pending ? "Adding..." : "Add slot"}
      </button>
    </form>
  );
}
