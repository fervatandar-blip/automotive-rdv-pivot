"use client";

import { useActionState, useState } from "react";
import { cancelAppointment, type CancelAppointmentState } from "@/app/actions/appointments";
import type { Locale } from "@/lib/i18n/config";
import { CLIENT_DANGER_PILL, CLIENT_TINTED_PILL } from "@/lib/client-ui";

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
        // Ghost pill, same box as the tinted pills next to it, pushed to the
        // row's end so the destructive action sits apart from the everyday ones.
        className={`${CLIENT_DANGER_PILL} ml-auto`}
      >
        {labels.cancel}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1.5 sm:ml-auto sm:w-auto">
      <div role="group" aria-label={labels.confirm} className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-ink">{labels.confirm}</span>
        <button
          type="button"
          autoFocus
          disabled={pending}
          onClick={() => setConfirming(false)}
          className={CLIENT_TINTED_PILL}
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
            className="inline-flex items-center rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:opacity-60 dark:bg-red-500/90 dark:hover:bg-red-500"
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
