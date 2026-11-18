"use client";

import { useActionState, useState } from "react";
import { cancelAppointment, type CancelAppointmentState } from "@/app/actions/appointments";
import type { Locale } from "@/lib/i18n/config";

/**
 * Cancelling frees the slot for someone else and can't be undone from
 * here, so it takes two taps: "Cancel" reveals "Keep" / "Yes, cancel".
 * While the request runs both buttons are disabled (no double submits);
 * a failure is reported instead of the card silently staying put.
 */
export function CancelBookingButton({
  appointmentId,
  lang,
  labels,
}: {
  appointmentId: string;
  lang: Locale;
  labels: {
    cancel: string;
    confirm: string;
    yes: string;
    keep: string;
    cancelling: string;
    failed: string;
    notAllowed: string;
  };
}) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState<CancelAppointmentState, FormData>(
    cancelAppointment,
    undefined
  );

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="rounded-full px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
      >
        {labels.cancel}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5 sm:w-auto">
      <div role="group" aria-label={labels.confirm} className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-black dark:text-zinc-50">{labels.confirm}</span>
        <button
          type="button"
          autoFocus
          disabled={pending}
          onClick={() => setConfirming(false)}
          className="rounded-full border border-zinc-200 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700/80 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          {labels.keep}
        </button>
        <form action={action}>
          <input type="hidden" name="id" value={appointmentId} />
          <input type="hidden" name="lang" value={lang} />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60 dark:bg-red-500/90 dark:hover:bg-red-500"
          >
            {pending ? labels.cancelling : labels.yes}
          </button>
        </form>
      </div>
      {!pending && state?.error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.error === "failed" ? labels.failed : labels.notAllowed}
        </p>
      )}
    </div>
  );
}
