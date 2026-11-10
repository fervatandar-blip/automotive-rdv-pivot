"use client";

import Link from "next/link";
import { useActionState, useId, useRef, useState } from "react";
import { AlertTriangle, CalendarOff, Check } from "lucide-react";
import { createAvailabilityBlock } from "@/app/actions/availability";
import {
  DialogShell,
  FIELD_INPUT_CLASS,
  FieldError,
  TRIGGER_BUTTON_CLASSES,
} from "@/components/dialog-shell";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type D = Dictionary["blockTime"];

/**
 * "Block time slot" button + modal: blocks part of one date for the whole
 * garage (availability_blocks, 0039). `today` comes from the server, in the
 * garage's zone, so the date picker's default and minimum never follow the
 * browser's own zone.
 */
export function BlockTimeButton({
  lang,
  d,
  label,
  today,
  variant = "secondary",
  collapseLabel = false,
}: {
  lang: Locale;
  d: D;
  label: string;
  today: string; // "YYYY-MM-DD" in APP_TIME_ZONE
  variant?: keyof typeof TRIGGER_BUTTON_CLASSES;
  // Icon-only below the sm breakpoint (label kept for screen readers).
  collapseLabel?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [formKey, setFormKey] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => dialogRef.current?.showModal()}
        title={collapseLabel || variant === "icon" ? label : undefined}
        className={TRIGGER_BUTTON_CLASSES[variant]}
      >
        <CalendarOff aria-hidden className="h-4 w-4" strokeWidth={2} />
        <span
          className={
            variant === "icon" ? "sr-only" : collapseLabel ? "sr-only sm:not-sr-only" : undefined
          }
        >
          {label}
        </span>
      </button>
      <DialogShell
        dialogRef={dialogRef}
        title={d.title}
        closeLabel={d.close}
        onClose={() => setFormKey((key) => key + 1)}
      >
        <BlockTimeForm
          key={formKey}
          lang={lang}
          d={d}
          today={today}
          onDone={() => dialogRef.current?.close()}
          onAnother={() => setFormKey((key) => key + 1)}
        />
      </DialogShell>
    </>
  );
}

function formatDateKey(dateKey: string, lang: Locale) {
  const [year, month, day] = dateKey.split("-").map(Number);
  // Noon UTC is the same calendar day in every European zone.
  return new Date(Date.UTC(year, month - 1, day, 12)).toLocaleDateString(
    lang === "fr" ? "fr-FR" : "en-GB",
    { timeZone: "UTC", weekday: "long", day: "numeric", month: "long" }
  );
}

function BlockTimeForm({
  lang,
  d,
  today,
  onDone,
  onAnother,
}: {
  lang: Locale;
  d: D;
  today: string;
  onDone: () => void;
  onAnother: () => void;
}) {
  const [state, action, pending] = useActionState(createAvailabilityBlock, undefined);
  const id = useId();
  const errors = state?.errors ?? {};
  const values = state?.values ?? {};
  const translate = (key: string) => d.errors[key as keyof D["errors"]] ?? key;

  if (state?.created) {
    const { date, startTime, endTime, overlapping } = state.created;
    return (
      <div role="status" className="flex flex-col gap-4 py-2">
        <p className="flex items-start gap-2 text-sm">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-600" strokeWidth={2.5} />
          <span>
            {d.created
              .replace("{range}", `${startTime}–${endTime}`)
              .replace("{date}", formatDateKey(date, lang))}
          </span>
        </p>
        {overlapping > 0 && (
          <p className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
            <AlertTriangle aria-hidden className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
            {d.overlapWarning.replace("{count}", String(overlapping))}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${lang}/garage/calendar?view=week&date=${date}`}
            onClick={onDone}
            className={TRIGGER_BUTTON_CLASSES.primary}
          >
            {d.openCalendar}
          </Link>
          <button type="button" onClick={onAnother} className={TRIGGER_BUTTON_CLASSES.secondary}>
            {d.blockAnother}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="lang" value={lang} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.intro}</p>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-date`} className="text-sm font-medium">
          {d.dateLabel}
        </label>
        <input
          id={`${id}-date`}
          name="date"
          type="date"
          required
          min={today}
          defaultValue={values.date ?? today}
          aria-invalid={Boolean(errors.date)}
          className={FIELD_INPUT_CLASS}
        />
        <FieldError messages={errors.date} translate={translate} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-start`} className="text-sm font-medium">
            {d.startLabel}
          </label>
          <input
            id={`${id}-start`}
            name="startTime"
            type="time"
            required
            step={300}
            defaultValue={values.startTime}
            aria-invalid={Boolean(errors.startTime)}
            className={FIELD_INPUT_CLASS}
          />
          <FieldError messages={errors.startTime} translate={translate} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-end`} className="text-sm font-medium">
            {d.endLabel}
          </label>
          <input
            id={`${id}-end`}
            name="endTime"
            type="time"
            required
            step={300}
            defaultValue={values.endTime}
            aria-invalid={Boolean(errors.endTime)}
            className={FIELD_INPUT_CLASS}
          />
          <FieldError messages={errors.endTime} translate={translate} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-reason`} className="text-sm font-medium">
          {d.reasonLabel}
        </label>
        <input
          id={`${id}-reason`}
          name="reason"
          maxLength={120}
          placeholder={d.reasonPlaceholder}
          defaultValue={values.reason}
          aria-invalid={Boolean(errors.reason)}
          className={FIELD_INPUT_CLASS}
        />
        <FieldError messages={errors.reason} translate={translate} />
      </div>

      {state?.message && (
        <p
          role="alert"
          className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400"
        >
          {translate(state.message)}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
        <button
          type="button"
          onClick={onDone}
          className="rounded-full px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]"
        >
          {d.cancel}
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {pending ? d.submitting : d.submit}
        </button>
      </div>
    </form>
  );
}
