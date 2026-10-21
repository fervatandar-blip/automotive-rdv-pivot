"use client";

import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { createAvailabilityOverride } from "@/app/actions/availability";

type AddOverrideFormDictionary = {
  title: string;
  description: string;
  dateLabel: string;
  closedAllDay: string;
  startLabel: string;
  endLabel: string;
  submit: string;
  submitPending: string;
};

export function AddOverrideForm({
  dictionary,
}: {
  dictionary: AddOverrideFormDictionary;
}) {
  const [state, action, pending] = useActionState(
    createAvailabilityOverride,
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
      className="group flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
    >
      <input type="hidden" name="lang" value={lang} />

      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        {dictionary.title}
      </h2>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {dictionary.description}
      </p>

      <div className="flex flex-col gap-1">
        <label htmlFor="overrideDate" className="text-sm font-medium">
          {dictionary.dateLabel}
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
        <input type="checkbox" name="isClosed" defaultChecked={false} />
        {dictionary.closedAllDay}
      </label>

      {/*
        Pure-CSS toggle (Tailwind v4's has-* variant) instead of React state:
        the closed checkbox lives inside this .group and .reset() (called
        after a successful submit, see the effect above) genuinely resets an
        uncontrolled checkbox's checked state, so there's no controlled-state/
        DOM-reset mismatch to work around.
      */}
      <div className="grid grid-cols-2 gap-4 group-has-[input[name=isClosed]:checked]:hidden">
        <div className="flex flex-col gap-1">
          <label htmlFor="overrideStartTime" className="text-sm font-medium">
            {dictionary.startLabel}
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
            {dictionary.endLabel}
          </label>
          <input
            id="overrideEndTime"
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
        {pending ? dictionary.submitPending : dictionary.submit}
      </button>
    </form>
  );
}
