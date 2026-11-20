"use client";

import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { normalizePricingType, PRICING_TYPES, type PricingType } from "@/lib/service-pricing";
import { SERVICE_CATEGORIES, type ServiceCategoryLabels } from "@/lib/service-categories";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ServiceFormState } from "@/lib/definitions";

export type ServiceFieldsDictionary = Dictionary["garageServices"]["fields"];

export const SERVICE_INPUT =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50 dark:placeholder:text-zinc-500 dark:focus:border-brand-500";
const LABEL = "text-sm font-medium text-black dark:text-zinc-50";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-xs text-red-600 dark:text-red-400">
      {messages[0]}
    </p>
  );
}

/**
 * The fields shared by "Add a service" and a row's edit form. The price
 * input is only rendered (and so only submitted) for a fixed or "from"
 * price; "Price on inspection" saves no amount (0045).
 */
export function ServiceFields({
  d,
  categoryLabels,
  errors,
  defaults,
}: {
  d: ServiceFieldsDictionary;
  categoryLabels: ServiceCategoryLabels;
  errors?: NonNullable<ServiceFormState>["errors"];
  defaults?: {
    name: string;
    description: string | null;
    category: string;
    durationMinutes: number;
    pricingType: string | null;
    price: number | string | null;
  };
}) {
  const id = useId();
  const [pricingType, setPricingType] = useState<PricingType>(
    normalizePricingType(defaults?.pricingType)
  );
  const optionLabels: Record<PricingType, string> = {
    fixed: d.pricingFixed,
    from: d.pricingFrom,
    on_inspection: d.pricingOnInspection,
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-name`} className={LABEL}>
          {d.nameLabel}
        </label>
        <input
          id={`${id}-name`}
          name="name"
          required
          minLength={2}
          defaultValue={defaults?.name}
          placeholder={d.namePlaceholder}
          className={SERVICE_INPUT}
        />
        <FieldError messages={errors?.name} />
      </div>

      <div className="flex flex-col gap-1.5 sm:max-w-xs">
        <label htmlFor={`${id}-category`} className={LABEL}>
          {d.categoryLabel}
        </label>
        <div className="relative">
          <select
            id={`${id}-category`}
            name="category"
            required
            // New services must pick one; there's no sensible default.
            defaultValue={defaults?.category ?? ""}
            className={`${SERVICE_INPUT} appearance-none pr-9`}
          >
            <option value="" disabled>
              {d.categoryPlaceholder}
            </option>
            {SERVICE_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categoryLabels[category]}
              </option>
            ))}
          </select>
          <ChevronDown
            aria-hidden
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
          />
        </div>
        <FieldError messages={errors?.category} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-description`} className={LABEL}>
          {d.descriptionLabel} <span className="font-normal text-zinc-500">({d.optional})</span>
        </label>
        <textarea
          id={`${id}-description`}
          name="description"
          rows={2}
          maxLength={500}
          defaultValue={defaults?.description ?? ""}
          placeholder={d.descriptionPlaceholder}
          className={SERVICE_INPUT}
        />
        <FieldError messages={errors?.description} />
      </div>

      <div className="flex flex-col gap-1.5 sm:max-w-[12rem]">
        <label htmlFor={`${id}-duration`} className={LABEL}>
          {d.durationLabel}
        </label>
        <input
          id={`${id}-duration`}
          name="durationMinutes"
          type="number"
          min="1"
          step="1"
          inputMode="numeric"
          required
          defaultValue={defaults?.durationMinutes}
          placeholder="60"
          className={SERVICE_INPUT}
        />
        <FieldError messages={errors?.durationMinutes} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${LABEL} mb-1.5`}>{d.pricingTypeLabel}</legend>
        <div className="inline-flex flex-wrap gap-1 self-start rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          {PRICING_TYPES.map((type) => (
            <label
              key={type}
              className={`cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-600/40 ${
                pricingType === type
                  ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              <input
                type="radio"
                name="pricingType"
                value={type}
                checked={pricingType === type}
                onChange={() => setPricingType(type)}
                className="sr-only"
              />
              {optionLabels[type]}
            </label>
          ))}
        </div>
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          {pricingType === "fixed"
            ? d.pricingFixedHint
            : pricingType === "from"
              ? d.pricingFromHint
              : d.pricingOnInspectionHint}
        </p>
        <FieldError messages={errors?.pricingType} />
      </fieldset>

      {pricingType !== "on_inspection" && (
        <div className="flex flex-col gap-1.5 sm:max-w-[12rem]">
          <label htmlFor={`${id}-price`} className={LABEL}>
            {pricingType === "from" ? d.startingPriceLabel : d.priceLabel}
          </label>
          <div className="relative">
            <input
              id={`${id}-price`}
              name="price"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              required
              defaultValue={defaults?.price ?? ""}
              placeholder="89.00"
              className={`${SERVICE_INPUT} pr-8 tabular-nums`}
            />
            <span aria-hidden className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500">
              €
            </span>
          </div>
          <FieldError messages={errors?.price} />
        </div>
      )}
    </div>
  );
}
