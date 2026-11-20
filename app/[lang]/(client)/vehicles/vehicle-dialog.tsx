"use client";

import { useParams } from "next/navigation";
import { useActionState, useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { saveVehicle } from "@/app/actions/vehicles";
import { DialogShell } from "@/components/dialog-shell";
import { StyledSelect } from "@/components/styled-select";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { VehicleFormState } from "@/lib/definitions";

type D = Dictionary["vehicles"];

export type EditableVehicle = {
  id: string;
  brandId: string | null;
  model: string | null;
  year: number | null;
  licensePlate: string | null;
  vin: string | null;
};

const INPUT =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-brand-500";
const LABEL = "text-sm font-medium text-black dark:text-zinc-50";
const PRIMARY =
  "inline-flex h-9 items-center justify-center rounded-full bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-600";
const GHOST =
  "inline-flex h-9 items-center justify-center rounded-full px-4 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-black dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";

function FieldError({ messages }: { messages?: string[] }) {
  return messages?.length ? (
    <p role="alert" className="text-xs text-red-600 dark:text-red-400">
      {messages[0]}
    </p>
  ) : null;
}

function VehicleForm({
  vehicle,
  brands,
  d,
  onDone,
}: {
  vehicle?: EditableVehicle;
  brands: { id: string; name: string }[];
  d: D;
  onDone: () => void;
}) {
  const [state, action, pending] = useActionState<VehicleFormState, FormData>(saveVehicle, undefined);
  const { lang } = useParams<{ lang: string }>();
  const id = useId();
  const f = d.form;

  useEffect(() => {
    if (state?.saved) onDone();
  }, [state, onDone]);

  const message = state?.message
    ? state.message === "notFound"
      ? f.notFound
      : f.genericError
    : null;

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="lang" value={lang} />
      {vehicle && <input type="hidden" name="id" value={vehicle.id} />}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-brand`} className={LABEL}>
            {f.brand}
          </label>
          <StyledSelect
            id={`${id}-brand`}
            name="brandId"
            defaultValue={vehicle?.brandId ?? ""}
            className="rounded-lg text-sm"
          >
            <option value="">{f.notSpecified}</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </StyledSelect>
          <FieldError messages={state?.errors?.brandId} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-model`} className={LABEL}>
            {f.model}
          </label>
          <input
            id={`${id}-model`}
            name="model"
            defaultValue={vehicle?.model ?? ""}
            placeholder={f.modelPlaceholder}
            maxLength={100}
            className={INPUT}
          />
          <FieldError messages={state?.errors?.model} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-year`} className={LABEL}>
            {f.year}
          </label>
          <input
            id={`${id}-year`}
            name="year"
            type="number"
            inputMode="numeric"
            min={1900}
            defaultValue={vehicle?.year ?? ""}
            placeholder={f.yearPlaceholder}
            className={INPUT}
          />
          <FieldError messages={state?.errors?.year} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-plate`} className={LABEL}>
            {f.licensePlate}
          </label>
          <input
            id={`${id}-plate`}
            name="licensePlate"
            defaultValue={vehicle?.licensePlate ?? ""}
            placeholder={f.licensePlatePlaceholder}
            maxLength={20}
            autoCapitalize="characters"
            className={`${INPUT} uppercase`}
          />
          <FieldError messages={state?.errors?.licensePlate} />
        </div>

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label htmlFor={`${id}-vin`} className={LABEL}>
            {f.vin}
          </label>
          <input
            id={`${id}-vin`}
            name="vin"
            defaultValue={vehicle?.vin ?? ""}
            maxLength={24}
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="WVWZZZ1KZAW123456"
            aria-describedby={`${id}-vin-hint`}
            className={`${INPUT} font-mono uppercase`}
          />
          <p id={`${id}-vin-hint`} className="text-xs text-zinc-500 dark:text-zinc-400">
            {f.vinHint}
          </p>
          <FieldError messages={state?.errors?.vin} />
        </div>
      </div>

      {message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-zinc-200/80 pt-4 dark:border-zinc-800/60">
        <button type="button" onClick={onDone} className={GHOST}>
          {f.cancel}
        </button>
        <button type="submit" disabled={pending} className={PRIMARY}>
          {pending ? (vehicle ? f.savePending : f.submitPending) : vehicle ? f.saveChanges : f.submit}
        </button>
      </div>
    </form>
  );
}

/**
 * A trigger button plus the add/edit modal it opens. The form remounts on
 * every open, so a cancelled edit never leaves stale values or errors.
 */
export function VehicleDialogButton({
  vehicle,
  brands,
  d,
  className,
  ariaLabel,
  children,
}: {
  vehicle?: EditableVehicle;
  brands: { id: string; name: string }[];
  d: D;
  className: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [openCount, setOpenCount] = useState(0);
  const [open, setOpen] = useState(false);
  // Stable so VehicleForm's "saved" effect doesn't re-fire on every render.
  const close = useCallback(() => dialogRef.current?.close(), []);

  return (
    <>
      <button
        type="button"
        aria-label={ariaLabel}
        className={className}
        onClick={() => {
          setOpenCount((count) => count + 1);
          setOpen(true);
          dialogRef.current?.showModal();
        }}
      >
        {children}
      </button>
      <DialogShell
        dialogRef={dialogRef}
        title={vehicle ? d.form.editVehicle : d.form.addVehicle}
        closeLabel={d.form.close}
        onClose={() => setOpen(false)}
      >
        {open && <VehicleForm key={openCount} vehicle={vehicle} brands={brands} d={d} onDone={close} />}
      </DialogShell>
    </>
  );
}
