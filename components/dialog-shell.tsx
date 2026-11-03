"use client";

import { useId, type ReactNode, type RefObject } from "react";
import { X } from "lucide-react";

/**
 * The garage area's modal frame: a native <dialog> (focus trap, Esc to
 * close and the backdrop come from the browser), a titled header with a
 * close button, and a scrolling body. The opener calls
 * dialogRef.current.showModal(); `onClose` fires however it was closed.
 */
export function DialogShell({
  dialogRef,
  title,
  closeLabel,
  onClose,
  children,
}: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  title: string;
  closeLabel: string;
  onClose?: () => void;
  children: ReactNode;
}) {
  const titleId = useId();

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      onClose={onClose}
      className="m-auto w-[min(100%-2rem,36rem)] rounded-2xl border border-black/[.08] bg-white p-0 text-black shadow-xl backdrop:bg-black/40 dark:border-white/[.145] dark:bg-zinc-950 dark:text-zinc-50"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center justify-between border-b border-black/[.08] px-5 py-4 dark:border-white/[.145]">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={closeLabel}
            className="rounded-full p-1.5 hover:bg-black/[.04] dark:hover:bg-white/[.06]"
          >
            <X className="h-5 w-5" strokeWidth={1.75} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </dialog>
  );
}

export const TRIGGER_BUTTON_CLASSES = {
  // Inside the top bar's action group: borderless, the group draws the frame.
  ghost:
    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
  primary:
    "flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600",
  secondary:
    "flex shrink-0 items-center gap-1.5 rounded-full border border-black/[.08] bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:bg-zinc-950 dark:text-zinc-50 dark:hover:bg-[#1a1a1a]",
} as const;

export const FIELD_INPUT_CLASS =
  "w-full rounded-md border border-black/[.08] bg-white px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black";

export function FieldError({
  id,
  messages,
  translate,
}: {
  id?: string;
  messages?: string[];
  translate: (key: string) => string;
}) {
  return messages?.length ? (
    <p id={id} className="text-sm text-red-600">
      {translate(messages[0])}
    </p>
  ) : null;
}
