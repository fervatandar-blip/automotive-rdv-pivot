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
      className="m-auto w-[min(100%-2rem,36rem)] rounded-2xl border border-hairline bg-surface p-0 text-ink shadow-xl backdrop:bg-black/40"
    >
      <div className="flex max-h-[85vh] flex-col">
        <div className="flex items-center justify-between border-b border-hairline px-5 py-4">
          <h2 id={titleId} className="text-lg font-semibold">
            {title}
          </h2>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label={closeLabel}
            className="rounded-full p-1.5 hover:bg-subtle"
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
  // Icon-only (label rendered sr-only + tooltip by the trigger): the top
  // bar's secondary actions.
  icon:
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40",
  // Inside the top bar's action group: borderless, the group draws the frame.
  ghost:
    "flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-subtle hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600/40",
  primary:
    "flex shrink-0 items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700",
  secondary:
    "flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-4 py-2 text-sm font-medium text-ink transition-colors hover:bg-subtle",
} as const;

export const FIELD_INPUT_CLASS =
  "w-full rounded-md border border-hairline bg-surface px-3 py-2 text-sm";

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
