"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";
import { SERVICE_CATEGORIES, type ServiceCategoryLabels } from "@/lib/service-categories";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ServiceFormState } from "@/lib/definitions";

export type ServiceFieldsDictionary = Dictionary["garageServices"]["fields"];

export const SERVICE_INPUT =
  "w-full rounded-xl border border-hairline bg-surface px-3.5 py-2.5 text-sm text-ink placeholder:text-ink-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:focus:border-brand-500";
const LABEL = "text-sm font-medium text-ink";

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return (
    <p role="alert" className="text-xs text-red-600 dark:text-red-400">
      {messages[0]}
    </p>
  );
}

/**
 * The fields shared by "Add a service" and a row's edit form: name,
 * category, description and duration. No price: services carry none since
 * 0050, the workshop quotes on site.
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
  };
}) {
  const id = useId();

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
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted"
          />
        </div>
        <FieldError messages={errors?.category} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-description`} className={LABEL}>
          {d.descriptionLabel} <span className="font-normal text-ink-muted">({d.optional})</span>
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
    </div>
  );
}
