"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState, useTransition } from "react";
import { Check, Plus, Search, X } from "lucide-react";
import { createWalkIn, getWalkInOptions, type WalkInOptions } from "@/app/actions/walk-ins";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type D = Dictionary["walkIn"];

const inputClass =
  "w-full rounded-md border border-black/[.08] px-3 py-2 text-sm dark:border-white/[.145] dark:bg-black";
const labelClass = "text-sm font-medium";

function FieldError({ messages }: { messages?: string[] }) {
  return messages?.length ? <p className="text-sm text-red-600">{messages[0]}</p> : null;
}

/**
 * "+ Walk-in" button and its modal, for the garage top bar. Options are
 * fetched when the modal opens rather than on every garage page render.
 */
export function QuickWalkInButton({ lang, d }: { lang: Locale; d: D }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [options, setOptions] = useState<WalkInOptions | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [loading, startLoading] = useTransition();
  // Remounting the form gives a clean slate after a booking or reopening.
  const [formKey, setFormKey] = useState(0);

  function open() {
    dialogRef.current?.showModal();
    setLoadError(false);
    startLoading(async () => {
      try {
        setOptions(await getWalkInOptions(lang));
      } catch {
        setLoadError(true);
      }
    });
  }

  function close() {
    dialogRef.current?.close();
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className="flex shrink-0 items-center gap-1.5 rounded-full bg-brand-600 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
      >
        <Plus className="h-4 w-4" strokeWidth={2.25} />
        <span className="hidden sm:inline">{d.openButton}</span>
        <span className="sm:hidden">{d.openButtonShort}</span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="walk-in-title"
        onClose={() => setFormKey((key) => key + 1)}
        className="m-auto w-[min(100%-2rem,36rem)] rounded-2xl border border-black/[.08] bg-white p-0 text-black shadow-xl backdrop:bg-black/40 dark:border-white/[.145] dark:bg-zinc-950 dark:text-zinc-50"
      >
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-black/[.08] px-5 py-4 dark:border-white/[.145]">
            <h2 id="walk-in-title" className="text-lg font-semibold">
              {d.title}
            </h2>
            <button type="button" onClick={close} aria-label={d.close} className="rounded-full p-1.5 hover:bg-black/[.04] dark:hover:bg-white/[.06]">
              <X className="h-5 w-5" strokeWidth={1.75} />
            </button>
          </div>

          <div className="overflow-y-auto px-5 py-4">
            {loading && !options && <p className="text-sm text-zinc-600 dark:text-zinc-400">{d.loading}</p>}
            {loadError && <p role="alert" className="text-sm text-red-600">{d.loadError}</p>}
            {options && options.services.length === 0 && (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {d.noServices}{" "}
                <Link href={`/${lang}/garage/services`} className="font-medium underline" onClick={close}>
                  {d.addServices}
                </Link>
              </p>
            )}
            {options && options.services.length > 0 && (
              <WalkInForm
                key={formKey}
                lang={lang}
                d={d}
                options={options}
                onDone={close}
                onAnother={() => setFormKey((key) => key + 1)}
              />
            )}
          </div>
        </div>
      </dialog>
    </>
  );
}

function WalkInForm({
  lang,
  d,
  options,
  onDone,
  onAnother,
}: {
  lang: Locale;
  d: D;
  options: WalkInOptions;
  onDone: () => void;
  onAnother: () => void;
}) {
  const [state, action, pending] = useActionState(createWalkIn, undefined);
  const [query, setQuery] = useState("");
  const [isNewCustomer, setIsNewCustomer] = useState(options.customers.length === 0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  // A brand-new customer usually arrives with a car to record.
  const [vehicleChoice, setVehicleChoice] = useState<string>(options.customers.length === 0 ? "new" : "none");
  const [when, setWhen] = useState<"now" | "at">("now");
  const errors = state?.errors ?? {};

  const selected = useMemo(
    () => options.customers.find((customer) => `${customer.kind}:${customer.id}` === selectedKey) ?? null,
    [options.customers, selectedKey]
  );
  const matches = useMemo(() => {
    const text = query.trim().toLowerCase();
    const list = text
      ? options.customers.filter(
          (customer) =>
            customer.name.toLowerCase().includes(text) ||
            (customer.detail ?? "").toLowerCase().includes(text) ||
            customer.vehicles.some((vehicle) => vehicle.label.toLowerCase().replace(/[^a-z0-9]/g, "").includes(text.replace(/[^a-z0-9]/g, "")))
        )
      : options.customers;
    return list.slice(0, 8);
  }, [options.customers, query]);

  // A new customer, or a walk-in customer, can have a new vehicle;
  // registered clients only bring vehicles they've added themselves.
  const canAddVehicle = isNewCustomer || selected?.kind === "garage_customer";
  const vehicles = isNewCustomer ? [] : selected?.vehicles ?? [];

  // Default the vehicle when the customer changes: their first car, or a
  // new one for a walk-in customer who has none on file.
  function selectCustomer(customer: WalkInOptions["customers"][number]) {
    setSelectedKey(`${customer.kind}:${customer.id}`);
    setVehicleChoice(
      customer.vehicles[0]?.id ?? (customer.kind === "garage_customer" ? "new" : "none")
    );
  }

  function toggleNewCustomer() {
    setIsNewCustomer((value) => !value);
    setSelectedKey(null);
    setVehicleChoice(isNewCustomer ? "none" : "new");
  }

  if (state?.created) {
    return (
      <div role="status" className="flex flex-col gap-4 py-2">
        <p className="flex items-start gap-2 text-sm">
          <Check className="mt-0.5 h-5 w-5 shrink-0 text-green-600" strokeWidth={2.5} />
          <span>
            {d.created
              .replace("{customer}", state.created.customerName)
              .replace("{time}", state.created.startLabel)
              .replace("{mechanic}", state.created.mechanicName ?? d.aMechanic)}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/${lang}/garage/calendar`}
            onClick={onDone}
            className="rounded-full bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            {d.openCalendar}
          </Link>
          <button
            type="button"
            onClick={onAnother}
            className="rounded-full border border-black/[.08] px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.06]"
          >
            {d.addAnother}
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-5">
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="customerKind" value={isNewCustomer ? "new" : selected?.kind ?? ""} />
      <input type="hidden" name="customerId" value={isNewCustomer ? "" : selected?.id ?? ""} />
      <input type="hidden" name="vehicleChoice" value={vehicleChoice} />

      {/* 1. Customer */}
      <fieldset className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <legend className={labelClass}>{d.customerLabel}</legend>
          {options.customers.length > 0 && (
            <button
              type="button"
              onClick={toggleNewCustomer}
              className="text-xs font-medium underline"
            >
              {isNewCustomer ? d.pickExisting : d.newCustomer}
            </button>
          )}
        </div>

        {isNewCustomer ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1 sm:col-span-2">
              <label htmlFor="walkin-name" className="sr-only">{d.nameLabel}</label>
              <input id="walkin-name" name="newName" placeholder={d.nameLabel} autoComplete="off" className={inputClass} />
              <FieldError messages={errors.newName} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="walkin-phone" className="sr-only">{d.phoneLabel}</label>
              <input id="walkin-phone" name="newPhone" type="tel" placeholder={d.phoneLabel} autoComplete="off" className={inputClass} />
              <FieldError messages={errors.newPhone} />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="walkin-email" className="sr-only">{d.emailLabel}</label>
              <input id="walkin-email" name="newEmail" type="email" placeholder={d.emailOptional} autoComplete="off" className={inputClass} />
              <FieldError messages={errors.newEmail} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="relative">
              <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" strokeWidth={1.75} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={d.searchPlaceholder}
                aria-label={d.searchPlaceholder}
                className={`${inputClass} pl-9`}
              />
            </div>
            <ul role="listbox" aria-label={d.customerLabel} className="flex max-h-48 flex-col gap-1 overflow-y-auto">
              {matches.map((customer) => {
                const key = `${customer.kind}:${customer.id}`;
                const isSelected = key === selectedKey;
                return (
                  <li key={key} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => selectCustomer(customer)}
                      className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm ${
                        isSelected
                          ? "border-brand-600 bg-brand-600/[.06] dark:border-brand-500"
                          : "border-black/[.06] hover:bg-black/[.03] dark:border-white/[.1] dark:hover:bg-white/[.04]"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate font-medium">{customer.name}</span>
                        <span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {[customer.detail, customer.vehicles[0]?.label].filter(Boolean).join(" · ")}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-black/[.04] px-2 py-0.5 text-[11px] font-medium dark:bg-white/[.08]">
                        {customer.kind === "client" ? d.badgeClient : d.badgeWalkIn}
                      </span>
                    </button>
                  </li>
                );
              })}
              {matches.length === 0 && <li className="px-1 text-sm text-zinc-500">{d.noMatch}</li>}
            </ul>
            <FieldError messages={errors.customerId ?? errors.customerKind} />
          </div>
        )}
      </fieldset>

      {/* 2. Vehicle */}
      {(isNewCustomer || selected) && (
        <fieldset className="flex flex-col gap-2">
          <legend className={labelClass}>{d.vehicleLabel}</legend>
          <div role="radiogroup" aria-label={d.vehicleLabel} className="flex flex-wrap gap-2">
            {vehicles.map((vehicle) => (
              <ChoiceChip key={vehicle.id} checked={vehicleChoice === vehicle.id} onSelect={() => setVehicleChoice(vehicle.id)}>
                {vehicle.label}
              </ChoiceChip>
            ))}
            {canAddVehicle && (
              <ChoiceChip checked={vehicleChoice === "new"} onSelect={() => setVehicleChoice("new")}>
                {d.newVehicle}
              </ChoiceChip>
            )}
            <ChoiceChip checked={vehicleChoice === "none"} onSelect={() => setVehicleChoice("none")}>
              {d.noVehicle}
            </ChoiceChip>
          </div>
          {vehicleChoice === "new" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="walkin-plate" className="sr-only">{d.plateLabel}</label>
                <input id="walkin-plate" name="plate" placeholder={d.plateLabel} autoCapitalize="characters" className={`${inputClass} font-mono uppercase`} />
                <FieldError messages={errors.plate} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="walkin-brand" className="sr-only">{d.brandLabel}</label>
                <select id="walkin-brand" name="brandId" defaultValue="" className={inputClass}>
                  <option value="">{d.brandLabel}</option>
                  {options.brands.map((brand) => (
                    <option key={brand.id} value={brand.id}>{brand.name}</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="walkin-model" className="sr-only">{d.modelLabel}</label>
                <input id="walkin-model" name="model" placeholder={d.modelLabel} className={inputClass} />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="walkin-vin" className="sr-only">{d.vinLabel}</label>
                <input id="walkin-vin" name="vin" placeholder={d.vinLabel} maxLength={24} spellCheck={false} className={`${inputClass} font-mono uppercase`} />
                <FieldError messages={errors.vin} />
              </div>
            </div>
          )}
          <FieldError messages={errors.vehicleChoice} />
        </fieldset>
      )}

      {/* 3. Service & mechanic */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="walkin-service" className={labelClass}>{d.serviceLabel}</label>
          <select id="walkin-service" name="serviceId" required defaultValue="" className={inputClass}>
            <option value="" disabled>{d.chooseService}</option>
            {options.services.map((service) => (
              <option key={service.id} value={service.id}>
                {service.name} ({service.durationMinutes} min)
              </option>
            ))}
          </select>
          <FieldError messages={errors.serviceId} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="walkin-mechanic" className={labelClass}>{d.mechanicLabel}</label>
          <select id="walkin-mechanic" name="mechanicId" defaultValue="" className={inputClass}>
            <option value="">{d.autoAssign}</option>
            {options.mechanics.map((mechanic) => (
              <option key={mechanic.id} value={mechanic.id}>
                {mechanic.name} — {mechanic.busyUntil ? d.busyUntil.replace("{time}", mechanic.busyUntil) : d.freeNow}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 4. When */}
      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>{d.whenLabel}</legend>
        <input type="hidden" name="when" value={when} />
        <div role="radiogroup" aria-label={d.whenLabel} className="flex flex-wrap items-center gap-2">
          <ChoiceChip checked={when === "now"} onSelect={() => setWhen("now")}>{d.now}</ChoiceChip>
          <ChoiceChip checked={when === "at"} onSelect={() => setWhen("at")}>{d.laterToday}</ChoiceChip>
          {when === "at" && (
            <input name="time" type="time" required aria-label={d.timeLabel} className="rounded-md border border-black/[.08] px-3 py-1.5 text-sm dark:border-white/[.145] dark:bg-black" />
          )}
        </div>
        <FieldError messages={errors.time} />
      </fieldset>

      {state?.message && (
        <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
          {state.message}
        </p>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm font-medium hover:bg-black/[.04] dark:hover:bg-white/[.06]">
          {d.cancel}
        </button>
        <button
          type="submit"
          disabled={pending || (!isNewCustomer && !selected)}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {pending ? d.creating : d.create}
        </button>
      </div>
    </form>
  );
}

function ChoiceChip({
  checked,
  onSelect,
  children,
}: {
  checked: boolean;
  onSelect: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onSelect}
      className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
        checked
          ? "border-brand-600 bg-brand-600 text-white dark:border-brand-500 dark:bg-brand-500"
          : "border-black/[.08] hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-white/[.06]"
      }`}
    >
      {children}
    </button>
  );
}
