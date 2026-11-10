"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Check, MoreHorizontal } from "lucide-react";
import {
  completeAppointment,
  providerCancelAppointment,
  updateRepairStage,
} from "@/app/actions/appointments";
import type { Locale } from "@/lib/i18n/config";

export type ActionsMenuLabels = {
  moreActions: string;
  message: string;
  reschedule: string;
  complete: string;
  stageHeading: string;
  cancelAppointment: string;
  cancelConfirm: string;
  cancelConfirmYes: string;
  cancelKeep: string;
};

const ITEM =
  "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-sm text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-black focus-visible:bg-zinc-100 focus-visible:outline-none dark:text-zinc-300 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-50 dark:focus-visible:bg-zinc-800/70";
const SECTION_LABEL =
  "px-2.5 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500";
const DIVIDER = "my-1 h-px bg-zinc-200/80 dark:bg-zinc-800/60";

/**
 * The "⋯" overflow for an agenda row: everything that isn't the row's one
 * primary action. A disclosure popover (button + aria-expanded), not an ARIA
 * menu: its items are plain links and form buttons reachable with Tab,
 * which avoids promising arrow-key menu semantics it doesn't implement.
 * Cancel is two-step -- it notifies the client and can't be undone here.
 */
export function AppointmentActionsMenu({
  appointmentId,
  lang,
  labels,
  canMessage,
  isOpen,
  showComplete,
  stages,
  currentStage,
}: {
  appointmentId: string;
  lang: Locale;
  labels: ActionsMenuLabels;
  // Registered client (walk-ins have no account to message).
  canMessage: boolean;
  // pending/confirmed: reschedule, cancel and stage changes apply.
  isOpen: boolean;
  // Complete isn't already the row's primary button (i.e. still pending).
  showComplete: boolean;
  // Repair stages (confirmed jobs only), in display order.
  stages: { value: string; label: string }[] | null;
  currentStage: string | null;
}) {
  const [open, setOpen] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  function close({ restoreFocus }: { restoreFocus: boolean }) {
    setOpen(false);
    setConfirmingCancel(false);
    if (restoreFocus) triggerRef.current?.focus();
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setConfirmingCancel(false);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        setConfirmingCancel(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const hasAnything = canMessage || isOpen || showComplete;
  if (!hasAnything) return null;

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-label={labels.moreActions}
        title={labels.moreActions}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        onClick={() => (open ? close({ restoreFocus: false }) : setOpen(true))}
        className={`flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:text-zinc-400 dark:hover:bg-zinc-800/70 dark:hover:text-zinc-50 ${
          open ? "bg-zinc-100 text-black dark:bg-zinc-800/70 dark:text-zinc-50" : ""
        }`}
      >
        <MoreHorizontal aria-hidden className="h-4 w-4" strokeWidth={2} />
      </button>

      {open && (
        <div
          id={panelId}
          className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-zinc-200/80 bg-white p-1 shadow-lg shadow-black/5 dark:border-zinc-800/80 dark:bg-zinc-900 dark:shadow-black/40"
        >
          {confirmingCancel ? (
            <div className="flex flex-col gap-2 p-2">
              <p className="text-sm font-medium text-black dark:text-zinc-50">{labels.cancelConfirm}</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  autoFocus
                  onClick={() => setConfirmingCancel(false)}
                  className="flex-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-700/80 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  {labels.cancelKeep}
                </button>
                <form action={providerCancelAppointment} className="flex-1">
                  <input type="hidden" name="id" value={appointmentId} />
                  <input type="hidden" name="lang" value={lang} />
                  <button
                    type="submit"
                    className="w-full rounded-md bg-red-600 px-2.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-red-700 dark:bg-red-500/90 dark:hover:bg-red-500"
                  >
                    {labels.cancelConfirmYes}
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <>
              {canMessage && (
                <Link
                  href={`/${lang}/appointments/${appointmentId}/messages`}
                  className={ITEM}
                  onClick={() => close({ restoreFocus: false })}
                >
                  {labels.message}
                </Link>
              )}
              {isOpen && (
                <Link
                  href={`/${lang}/appointments/${appointmentId}/reschedule`}
                  className={ITEM}
                  onClick={() => close({ restoreFocus: false })}
                >
                  {labels.reschedule}
                </Link>
              )}
              {showComplete && (
                <form action={completeAppointment}>
                  <input type="hidden" name="id" value={appointmentId} />
                  <input type="hidden" name="lang" value={lang} />
                  <button type="submit" className={ITEM}>
                    {labels.complete}
                  </button>
                </form>
              )}

              {stages && stages.length > 0 && (
                <>
                  <div className={DIVIDER} />
                  <p className={SECTION_LABEL}>{labels.stageHeading}</p>
                  {stages.map((stage) => {
                    const current = stage.value === currentStage;
                    return (
                      <form key={stage.value} action={updateRepairStage}>
                        <input type="hidden" name="id" value={appointmentId} />
                        <input type="hidden" name="lang" value={lang} />
                        <input type="hidden" name="stage" value={stage.value} />
                        <button
                          type="submit"
                          disabled={current}
                          aria-current={current ? "true" : undefined}
                          className={`${ITEM} justify-between disabled:cursor-default disabled:hover:bg-transparent ${
                            current ? "font-medium text-black dark:text-zinc-50" : ""
                          }`}
                        >
                          {stage.label}
                          {current && <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.25} />}
                        </button>
                      </form>
                    );
                  })}
                </>
              )}

              {isOpen && (
                <>
                  <div className={DIVIDER} />
                  <button
                    type="button"
                    onClick={() => setConfirmingCancel(true)}
                    className={`${ITEM} text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300`}
                  >
                    {labels.cancelAppointment}
                  </button>
                </>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
