"use client";

import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { createAvailabilityOverride } from "@/app/actions/availability";

export function AddOverrideForm() {
  const [state, action, pending] = useActionState(
    createAvailabilityOverride,
    undefined
  );
  const formRef = useRef<HTMLFormElement>(null);
  const { lang } = useParams<{ lang: string }>();
  const [isClosed, setIsClosed] = useState(false);

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
        Add a date override
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Close a specific date (holiday, staff leave) or set one-off hours
        that replace your normal weekly schedule for that date.
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="overrideDate" className="text-sm font-medium">
          Date
        </label>
        <input
          id="overrideDate"
          name="date"
          type="date"
          className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
        {state?.errors?.date && (
          <p className="text-sm text-red-600">{state.errors.date[0]}</p>
        )}
      </div>

      <label className="flex items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          name="isClosed"
          defaultChecked={false}
          onChange={(event) => setIsClosed(event.target.checked)}
        />
        Closed all day
      </label>

      {!isClosed && (
        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-1">
            <label htmlFor="overrideStartTime" className="text-sm font-medium">
              Start
            </label>
            <input
              id="overrideStartTime"
              name="startTime"
              type="time"
              defaultValue="09:00"
              className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
            />
            {state?.errors?.startTime && (
              <p className="text-sm text-red-600">
                {state.errors.startTime[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="overrideEndTime" className="text-sm font-medium">
              End
            </label>
            <input
              id="overrideEndTime"
              name="endTime"
              type="time"
              defaultValue="17:00"
              className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
            />
            {state?.errors?.endTime && (
              <p className="text-sm text-red-600">
                {state.errors.endTime[0]}
              </p>
            )}
          </div>
        </div>
      )}

      {state?.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      <button
        disabled={pending}
        type="submit"
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {pending ? "Adding..." : "Add override"}
      </button>
    </form>
  );
}
