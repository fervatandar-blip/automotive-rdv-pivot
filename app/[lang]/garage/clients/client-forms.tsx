"use client";

import { useActionState, useId, useState } from "react";
import { Clock, Mail, Pencil, Phone, Plus, Star } from "lucide-react";
import { addCustomerVehicle, saveClientDetails } from "@/app/actions/clients";
import { FieldError, FIELD_INPUT_CLASS } from "@/components/dialog-shell";
import type { ClientDetailsFormState, CustomerVehicleFormState } from "@/lib/definitions";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type D = Dictionary["garageClients"];

const SECONDARY_BUTTON =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-200 px-3.5 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-black disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";
const PRIMARY_BUTTON =
  "inline-flex items-center justify-center rounded-full bg-brand-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:cursor-wait disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-600";

export type ClientDetailsValues = {
  kind: "client" | "walk_in";
  subjectId: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  preferredContactTime: string | null;
  isVip: boolean;
  anonymized: boolean;
};

/**
 * Contact details and notes, read-only until "Edit". The garage's own
 * customers can have their name, phone and email changed; registered
 * clients manage their own profile, so only the garage-kept phone, notes,
 * VIP flag and preferred contact time are editable for them.
 */
export function ClientDetailsCard({
  lang,
  d,
  values,
  startInEdit,
}: {
  lang: Locale;
  d: D;
  values: ClientDetailsValues;
  startInEdit: boolean;
}) {
  const [editing, setEditing] = useState(startInEdit && !values.anonymized);
  const [state, action, pending] = useActionState(
    async (previous: ClientDetailsFormState, formData: FormData) => {
      const result = await saveClientDetails(previous, formData);
      if (result?.saved) setEditing(false);
      return result;
    },
    undefined
  );
  const id = useId();
  const errors = state?.errors ?? {};
  const echoed = state?.values;
  const translate = (key: string) => d.errors[key as keyof D["errors"]] ?? key;
  const isWalkIn = values.kind === "walk_in";

  if (!editing) {
    return (
      <section aria-labelledby={`${id}-contact`} className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2">
          <h3 id={`${id}-contact`} className="text-sm font-semibold text-black dark:text-zinc-50">
            {d.contactTitle}
          </h3>
          {!values.anonymized && (
            <button type="button" onClick={() => setEditing(true)} className={SECONDARY_BUTTON}>
              <Pencil aria-hidden className="h-3.5 w-3.5" />
              {d.edit}
            </button>
          )}
        </div>
        {state?.saved && (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            {d.saved}
          </p>
        )}
        <dl className="flex flex-col gap-2.5 text-sm">
          <div className="flex items-center gap-2.5">
            <dt className="sr-only">{d.phoneLabel}</dt>
            <Phone aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
            <dd>
              {values.phone ? (
                <a
                  href={`tel:${values.phone.replace(/[^\d+]/g, "")}`}
                  className="font-medium text-black hover:text-brand-600 dark:text-zinc-50 dark:hover:text-brand-400"
                >
                  {values.phone}
                </a>
              ) : (
                <span className="text-zinc-500 dark:text-zinc-400">{d.noPhone}</span>
              )}
            </dd>
          </div>
          <div className="flex items-center gap-2.5">
            <dt className="sr-only">{d.emailLabel}</dt>
            <Mail aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
            <dd className="min-w-0 truncate">
              {values.email ? (
                <a
                  href={`mailto:${values.email}`}
                  className="text-black hover:text-brand-600 dark:text-zinc-50 dark:hover:text-brand-400"
                >
                  {values.email}
                </a>
              ) : (
                <span className="text-zinc-500 dark:text-zinc-400">—</span>
              )}
            </dd>
          </div>
          {values.preferredContactTime && (
            <div className="flex items-center gap-2.5">
              <dt className="sr-only">{d.preferredTimeLabel}</dt>
              <Clock aria-hidden className="h-4 w-4 shrink-0 text-zinc-400" />
              <dd className="text-black dark:text-zinc-50">{values.preferredContactTime}</dd>
            </div>
          )}
          {values.isVip && (
            <div className="flex items-center gap-2.5">
              <dt className="sr-only">{d.vipLabel}</dt>
              <Star aria-hidden className="h-4 w-4 shrink-0 fill-amber-400 text-amber-400" />
              <dd className="font-medium text-amber-800 dark:text-amber-300">{d.vip}</dd>
            </div>
          )}
        </dl>
        <div className="flex flex-col gap-1.5">
          <h3 className="text-sm font-semibold text-black dark:text-zinc-50">{d.notesTitle}</h3>
          {values.notes ? (
            <p className="whitespace-pre-wrap rounded-lg bg-zinc-50 px-3 py-2 text-sm text-zinc-800 dark:bg-zinc-800/60 dark:text-zinc-200">
              {values.notes}
            </p>
          ) : (
            <p className="text-sm text-zinc-500 dark:text-zinc-400">{d.noNotes}</p>
          )}
        </div>
      </section>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="kind" value={values.kind} />
      <input type="hidden" name="subjectId" value={values.subjectId} />
      <h3 className="text-sm font-semibold text-black dark:text-zinc-50">{d.editTitle}</h3>

      {isWalkIn && (
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-name`} className="text-sm font-medium">
            {d.nameLabel}
          </label>
          <input
            id={`${id}-name`}
            name="name"
            required
            maxLength={120}
            defaultValue={echoed?.name ?? values.name}
            className={FIELD_INPUT_CLASS}
          />
          <FieldError messages={errors.name} translate={translate} />
        </div>
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-phone`} className="text-sm font-medium">
            {d.phoneLabel}
          </label>
          <input
            id={`${id}-phone`}
            name="phone"
            type="tel"
            maxLength={40}
            defaultValue={echoed?.phone ?? values.phone ?? ""}
            aria-describedby={isWalkIn ? undefined : `${id}-phone-hint`}
            className={FIELD_INPUT_CLASS}
          />
          <FieldError messages={errors.phone} translate={translate} />
        </div>
        {isWalkIn && (
          <div className="flex flex-col gap-1">
            <label htmlFor={`${id}-email`} className="text-sm font-medium">
              {d.emailLabel}
            </label>
            <input
              id={`${id}-email`}
              name="email"
              type="email"
              defaultValue={echoed?.email ?? values.email ?? ""}
              className={FIELD_INPUT_CLASS}
            />
            <FieldError messages={errors.email} translate={translate} />
          </div>
        )}
      </div>
      {!isWalkIn && (
        <p id={`${id}-phone-hint`} className="-mt-2 text-xs text-zinc-500 dark:text-zinc-400">
          {d.clientPhoneHint}
        </p>
      )}
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-time`} className="text-sm font-medium">
          {d.preferredTimeLabel}
        </label>
        <input
          id={`${id}-time`}
          name="preferredContactTime"
          maxLength={80}
          placeholder={d.preferredTimePlaceholder}
          defaultValue={echoed?.preferredContactTime ?? values.preferredContactTime ?? ""}
          className={FIELD_INPUT_CLASS}
        />
        <FieldError messages={errors.preferredContactTime} translate={translate} />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isVip"
          defaultChecked={echoed ? echoed.isVip === "on" : values.isVip}
        />
        {d.vipLabel}
      </label>
      <div className="flex flex-col gap-1">
        <label htmlFor={`${id}-notes`} className="text-sm font-medium">
          {d.notesLabel}
        </label>
        <textarea
          id={`${id}-notes`}
          name="notes"
          rows={4}
          maxLength={2000}
          placeholder={d.notesPlaceholder}
          defaultValue={echoed?.notes ?? values.notes ?? ""}
          className={FIELD_INPUT_CLASS}
        />
        <FieldError messages={errors.notes} translate={translate} />
      </div>
      {state?.message && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {translate(state.message)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setEditing(false)} disabled={pending} className={SECONDARY_BUTTON}>
          {d.cancel}
        </button>
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? d.saving : d.save}
        </button>
      </div>
    </form>
  );
}

/** "+ Add vehicle" for the garage's own customers. */
export function AddVehicleForm({
  lang,
  d,
  addClientD,
  customerId,
  brands,
}: {
  lang: Locale;
  d: D;
  addClientD: Dictionary["addClient"];
  customerId: string;
  brands: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const [state, action, pending] = useActionState(
    async (previous: CustomerVehicleFormState, formData: FormData) => {
      const result = await addCustomerVehicle(previous, formData);
      if (result?.added) {
        setOpen(false);
        setFormKey((key) => key + 1);
      }
      return result;
    },
    undefined
  );
  const id = useId();
  const errors = state?.errors ?? {};
  const echoed = state?.values ?? {};
  const translate = (key: string) => addClientD.errors[key as keyof Dictionary["addClient"]["errors"]] ?? key;

  if (!open) {
    return (
      <div className="flex flex-col gap-2">
        {state?.added && (
          <p role="status" className="text-sm text-green-700 dark:text-green-400">
            {d.vehicleAdded}
          </p>
        )}
        <button type="button" onClick={() => setOpen(true)} className={`${SECONDARY_BUTTON} self-start`}>
          <Plus aria-hidden className="h-3.5 w-3.5" />
          {d.addVehicle}
        </button>
      </div>
    );
  }

  return (
    <form
      key={formKey}
      action={action}
      className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
    >
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="customerId" value={customerId} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-plate`} className="text-sm">
            {addClientD.plateLabel}
          </label>
          <input
            id={`${id}-plate`}
            name="plate"
            maxLength={20}
            autoCapitalize="characters"
            spellCheck={false}
            defaultValue={echoed.plate}
            className={`${FIELD_INPUT_CLASS} font-mono uppercase`}
          />
          <FieldError messages={errors.plate} translate={translate} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-brand`} className="text-sm">
            {addClientD.brandLabel}
          </label>
          <select id={`${id}-brand`} name="brandId" defaultValue={echoed.brandId ?? ""} className={FIELD_INPUT_CLASS}>
            <option value="">—</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-model`} className="text-sm">
            {addClientD.modelLabel}
          </label>
          <input id={`${id}-model`} name="model" maxLength={100} defaultValue={echoed.model} className={FIELD_INPUT_CLASS} />
          <FieldError messages={errors.model} translate={translate} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor={`${id}-year`} className="text-sm">
            {addClientD.yearLabel}
          </label>
          <input
            id={`${id}-year`}
            name="year"
            inputMode="numeric"
            maxLength={4}
            defaultValue={echoed.year}
            className={FIELD_INPUT_CLASS}
          />
          <FieldError messages={errors.year} translate={translate} />
        </div>
        <div className="flex flex-col gap-1 sm:col-span-2">
          <label htmlFor={`${id}-vin`} className="text-sm">
            {addClientD.vinLabel}
          </label>
          <input
            id={`${id}-vin`}
            name="vin"
            maxLength={24}
            spellCheck={false}
            autoCapitalize="characters"
            defaultValue={echoed.vin}
            className={`${FIELD_INPUT_CLASS} font-mono uppercase`}
          />
          <FieldError messages={errors.vin} translate={translate} />
        </div>
      </div>
      {state?.message && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-500/10 dark:text-red-300">
          {translate(state.message)}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} disabled={pending} className={SECONDARY_BUTTON}>
          {d.cancel}
        </button>
        <button type="submit" disabled={pending} className={PRIMARY_BUTTON}>
          {pending ? d.saving : d.addVehicle}
        </button>
      </div>
    </form>
  );
}
