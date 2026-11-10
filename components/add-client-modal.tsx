"use client";

import Link from "next/link";
import { useActionState, useId, useRef, useState, useTransition } from "react";
import { Check, UserPlus } from "lucide-react";
import { createGarageCustomer, getBrandOptions } from "@/app/actions/garage-customers";
import {
  DialogShell,
  FIELD_INPUT_CLASS,
  FieldError,
  TRIGGER_BUTTON_CLASSES,
} from "@/components/dialog-shell";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type D = Dictionary["addClient"];
export type BrandOption = { id: string; name: string };

/**
 * "Add client" button + modal: saves a garage customer (and optionally one
 * vehicle) without booking a job. Lives in the garage top bar. The makes
 * list is fetched on first open, not on every page render.
 */
export function AddClientButton({
  lang,
  d,
  label,
  variant = "secondary",
  collapseLabel = false,
}: {
  lang: Locale;
  d: D;
  label: string;
  variant?: keyof typeof TRIGGER_BUTTON_CLASSES;
  // Icon-only below the sm breakpoint (label kept for screen readers).
  collapseLabel?: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // Remounting the form gives a clean slate after saving or reopening.
  const [formKey, setFormKey] = useState(0);
  const [brands, setBrands] = useState<BrandOption[] | null>(null);
  const [, startLoading] = useTransition();

  function open() {
    dialogRef.current?.showModal();
    if (brands === null) {
      startLoading(async () => {
        try {
          setBrands(await getBrandOptions(lang));
        } catch {
          // The make is optional; the form still works without the list.
          setBrands([]);
        }
      });
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        title={collapseLabel || variant === "icon" ? label : undefined}
        className={TRIGGER_BUTTON_CLASSES[variant]}
      >
        <UserPlus aria-hidden className="h-4 w-4" strokeWidth={2} />
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
        <AddClientForm
          key={formKey}
          lang={lang}
          d={d}
          brands={brands ?? []}
          onDone={() => dialogRef.current?.close()}
          onAnother={() => setFormKey((key) => key + 1)}
        />
      </DialogShell>
    </>
  );
}

function AddClientForm({
  lang,
  d,
  brands,
  onDone,
  onAnother,
}: {
  lang: Locale;
  d: D;
  brands: BrandOption[];
  onDone: () => void;
  onAnother: () => void;
}) {
  const [state, action, pending] = useActionState(createGarageCustomer, undefined);
  const id = useId();
  const errors = state?.errors ?? {};
  const values = state?.values ?? {};
  const translate = (key: string) => d.errors[key as keyof D["errors"]] ?? key;

  if (state?.created) {
    return (
      <div role="status" className="flex flex-col gap-4 py-2">
        <p className="flex items-start gap-2 text-sm">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-600" strokeWidth={2.5} />
          <span>{d.created.replace("{name}", state.created.name)}</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${lang}/garage/clients?q=${encodeURIComponent(state.created.name)}`}
            onClick={onDone}
            className={TRIGGER_BUTTON_CLASSES.primary}
          >
            {d.openDirectory}
          </Link>
          <button type="button" onClick={onAnother} className={TRIGGER_BUTTON_CLASSES.secondary}>
            {d.addAnother}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="lang" value={lang} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.intro}</p>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">{d.contactSection}</legend>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="text-sm">
            {d.nameLabel}
          </label>
          <input
            id={`${id}-name`}
            name="name"
            defaultValue={values.name}
            required
            maxLength={120}
            autoComplete="off"
            aria-invalid={Boolean(errors.name)}
            className={FIELD_INPUT_CLASS}
          />
          <FieldError messages={errors.name} translate={translate} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-phone`} className="text-sm">
              {d.phoneLabel}
            </label>
            <input
              id={`${id}-phone`}
              name="phone"
              defaultValue={values.phone}
              type="tel"
              maxLength={40}
              autoComplete="off"
              aria-describedby={`${id}-contact-hint`}
              aria-invalid={Boolean(errors.phone)}
              className={FIELD_INPUT_CLASS}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-email`} className="text-sm">
              {d.emailLabel}
            </label>
            <input
              id={`${id}-email`}
              name="email"
              defaultValue={values.email}
              type="email"
              autoComplete="off"
              aria-describedby={`${id}-contact-hint`}
              aria-invalid={Boolean(errors.email)}
              className={FIELD_INPUT_CLASS}
            />
          </div>
        </div>
        <p id={`${id}-contact-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">
          {d.contactHint}
        </p>
        <FieldError messages={errors.phone} translate={translate} />
        <FieldError messages={errors.email} translate={translate} />
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-sm font-medium">{d.vehicleSection}</legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-plate`} className="text-sm">
              {d.plateLabel}
            </label>
            <input
              id={`${id}-plate`}
              name="plate"
              defaultValue={values.plate}
              maxLength={20}
              autoCapitalize="characters"
              spellCheck={false}
              aria-invalid={Boolean(errors.plate)}
              className={`${FIELD_INPUT_CLASS} font-mono uppercase`}
            />
            <FieldError messages={errors.plate} translate={translate} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-brand`} className="text-sm">
              {d.brandLabel}
            </label>
            <select
              id={`${id}-brand`}
              name="brandId"
              defaultValue={values.brandId ?? ""}
              className={FIELD_INPUT_CLASS}
            >
              <option value="">—</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
            <FieldError messages={errors.brandId} translate={translate} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-model`} className="text-sm">
              {d.modelLabel}
            </label>
            <input
              id={`${id}-model`}
              name="model"
              defaultValue={values.model}
              maxLength={100}
              aria-invalid={Boolean(errors.model)}
              className={FIELD_INPUT_CLASS}
            />
            <FieldError messages={errors.model} translate={translate} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-year`} className="text-sm">
              {d.yearLabel}
            </label>
            <input
              id={`${id}-year`}
              name="year"
              defaultValue={values.year}
              inputMode="numeric"
              pattern="\d{4}"
              maxLength={4}
              aria-invalid={Boolean(errors.year)}
              className={FIELD_INPUT_CLASS}
            />
            <FieldError messages={errors.year} translate={translate} />
          </div>
          <div className="flex flex-col gap-1 sm:col-span-2">
            <label htmlFor={`${id}-vin`} className="text-sm">
              {d.vinLabel}
            </label>
            <input
              id={`${id}-vin`}
              name="vin"
              defaultValue={values.vin}
              maxLength={24}
              spellCheck={false}
              autoCapitalize="characters"
              aria-invalid={Boolean(errors.vin)}
              className={`${FIELD_INPUT_CLASS} font-mono uppercase`}
            />
            <FieldError messages={errors.vin} translate={translate} />
          </div>
        </div>
      </fieldset>

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
