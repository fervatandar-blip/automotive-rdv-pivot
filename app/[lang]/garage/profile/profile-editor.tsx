"use client";

import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { Check, Lock } from "lucide-react";
import { updateGarageProfile } from "@/app/actions/garage";
import { GarageMapPicker } from "@/components/garage-map-picker";
import { StyledSelect } from "@/components/styled-select";
import { CheckboxChip } from "@/components/checkbox-chip";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import {
  COUNTRIES,
  COUNTRY_NAMES,
  REGISTRATION_CONFIG,
  type Country,
} from "@/lib/business-registration";
import {
  GARAGE_DESCRIPTION_MAX_LENGTH,
  GARAGE_LANGUAGES,
  type GarageProfileSection,
} from "@/lib/definitions";
import type { DayHours } from "@/lib/opening-hours";

type ProfileDictionary = Dictionary["garageProfile"];
type FieldDictionary = Dictionary["garageOnboarding"];

export type ProfileGarage = {
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  country: string;
  registration_number: string | null;
  vat_number: string | null;
  pricing_category: string | null;
  technician_count: number | null;
  ev_capable: boolean;
  mobile_service: boolean;
  emergency_service: boolean;
  languages_spoken: string[] | null;
  latitude: number | null;
  longitude: number | null;
};

const inputClass =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:focus:border-brand-500";
const labelClass = "text-sm font-medium text-ink";
const CARD =
  "flex flex-col gap-4 rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-5";

/**
 * One independently-saved profile section: its own form, its own action
 * state, its own Save button and saved/error feedback.
 */
function ProfileSection({
  section,
  lang,
  title,
  description,
  p,
  children,
}: {
  section: GarageProfileSection;
  lang: Locale;
  title: string;
  description: string;
  p: ProfileDictionary;
  children: (errors: Record<string, string[] | undefined>) => ReactNode;
}) {
  const [state, action, pending] = useActionState(updateGarageProfile, undefined);
  const errors = (state?.errors ?? {}) as Record<string, string[] | undefined>;

  return (
    <form action={action} aria-labelledby={`section-${section}-title`} className={CARD}>
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="section" value={section} />

      <div>
        <h2 id={`section-${section}-title`} className="font-semibold text-ink">
          {title}
        </h2>
        <p className="mt-0.5 text-sm text-ink-muted">{description}</p>
      </div>

      {children(errors)}

      <div className="flex flex-wrap items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-ink px-4 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-ink/85 disabled:opacity-50"
        >
          {pending ? p.saving : p.save}
        </button>
        {!pending && state?.savedAt && (
          <span role="status" className="flex items-center gap-1 text-sm text-green-700 dark:text-green-500">
            <Check className="h-4 w-4" strokeWidth={2.5} />
            {p.saved}
          </span>
        )}
        {!pending && state?.message && (
          <span role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-xs text-red-600 dark:text-red-400">{messages[0]}</p>;
}

function Field({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string[];
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      {children}
      <FieldError messages={error} />
    </div>
  );
}

/** Left column: identity, contact and legal details. */
function DetailsFields({
  garage,
  d,
  p,
  identityLocked,
  errors,
}: {
  garage: ProfileGarage;
  d: FieldDictionary;
  p: ProfileDictionary;
  identityLocked: boolean;
  errors: Record<string, string[] | undefined>;
}) {
  const [country, setCountry] = useState<Country>(
    COUNTRIES.includes(garage.country as Country) ? (garage.country as Country) : "LU"
  );
  const [descriptionLength, setDescriptionLength] = useState(garage.description?.length ?? 0);
  const registrationConfig = REGISTRATION_CONFIG[country];

  return (
    <div className="flex flex-col gap-4">
      <Field id="name" label={d.nameLabel} error={errors.name}>
        <input id="name" name="name" required minLength={2} defaultValue={garage.name} className={inputClass} />
      </Field>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="description" className={labelClass}>
            {d.descriptionLabel}
          </label>
          <span
            className={`text-xs tabular-nums ${
              descriptionLength > GARAGE_DESCRIPTION_MAX_LENGTH ? "text-red-600" : "text-ink-muted"
            }`}
          >
            {descriptionLength}/{GARAGE_DESCRIPTION_MAX_LENGTH}
          </span>
        </div>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={garage.description ?? ""}
          onChange={(event) => setDescriptionLength(event.target.value.length)}
          placeholder={p.descriptionPlaceholder}
          className={inputClass}
        />
        <FieldError messages={errors.description} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="phone" label={d.phoneLabel} error={errors.phone}>
          <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={garage.phone ?? ""} className={inputClass} />
        </Field>
        <Field id="email" label={d.businessEmailLabel} error={errors.email}>
          <input id="email" name="email" type="email" autoComplete="email" defaultValue={garage.email ?? ""} className={inputClass} />
        </Field>
      </div>

      <Field id="website" label={d.websiteLabel} error={errors.website}>
        <input
          id="website"
          name="website"
          type="url"
          placeholder="https://yourworkshop.lu"
          defaultValue={garage.website ?? ""}
          className={inputClass}
        />
      </Field>

      <fieldset className="flex flex-col gap-3 border-t border-hairline pt-4">
        <legend className="float-left mb-1 w-full text-sm font-semibold text-ink">
          {p.legalTitle}
        </legend>
        {identityLocked && (
          <p className="flex items-start gap-2 text-xs text-ink-muted">
            <Lock className="mt-px h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            {p.legalLockedNote}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="country" label={d.countryLabel} error={errors.country}>
            {identityLocked ? (
              <input id="country" readOnly value={COUNTRY_NAMES[country]} className={`${inputClass} text-ink-muted`} />
            ) : (
              <StyledSelect
                id="country"
                name="country"
                value={country}
                onChange={(event) => setCountry(event.target.value as Country)}
              >
                {COUNTRIES.map((code) => (
                  <option key={code} value={code}>
                    {COUNTRY_NAMES[code]}
                  </option>
                ))}
              </StyledSelect>
            )}
          </Field>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="registrationNumber" className={labelClass}>
              {registrationConfig.label}
            </label>
            <input
              id="registrationNumber"
              name={identityLocked ? undefined : "registrationNumber"}
              readOnly={identityLocked}
              defaultValue={garage.registration_number ?? ""}
              placeholder={registrationConfig.placeholder}
              className={`${inputClass} ${identityLocked ? "text-ink-muted" : ""}`}
            />
            {!identityLocked && (
              <p className="text-xs text-ink-muted">{registrationConfig.hint}</p>
            )}
            <FieldError messages={errors.registrationNumber} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="vatNumber" className={labelClass}>
            {d.vatNumberLabel}
          </label>
          <input id="vatNumber" name="vatNumber" defaultValue={garage.vat_number ?? ""} placeholder="LU12345678" className={inputClass} />
          <p className="text-xs text-ink-muted">{d.vatNumberHint}</p>
        </div>
      </fieldset>
    </div>
  );
}

function OpeningHoursSummary({
  lang,
  d,
  p,
  weeklyHours,
}: {
  lang: Locale;
  d: FieldDictionary;
  p: ProfileDictionary;
  weeklyHours: DayHours[];
}) {
  const hasHours = weeklyHours.some((day) => day.ranges.length > 0);
  // Monday first, like the Working hours page.
  const week = [...weeklyHours].sort((a, b) => ((a.dayOfWeek + 6) % 7) - ((b.dayOfWeek + 6) % 7));

  return (
    <section aria-labelledby="section-hours-title" className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="section-hours-title" className="font-semibold text-ink">
            {d.openingHoursTitle}
          </h2>
          <p className="mt-0.5 text-sm text-ink-muted">{p.hoursDescription}</p>
        </div>
        <Link
          href={`/${lang}/garage/availability`}
          className="shrink-0 rounded-full border border-hairline px-3 py-1 text-sm font-medium text-ink transition-colors hover:bg-subtle hover:text-ink"
        >
          {p.manageHours}
        </Link>
      </div>
      {hasHours ? (
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1 text-sm">
          {week.map((day) => (
            <div key={day.dayOfWeek} className="contents">
              <dt className="text-ink-muted">{d.days[day.dayOfWeek]}</dt>
              <dd className="font-medium tabular-nums text-ink">
                {day.ranges.length > 0 ? day.ranges.join(", ") : d.closed}
              </dd>
            </div>
          ))}
        </dl>
      ) : (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
          {p.noHours}
        </p>
      )}
    </section>
  );
}

/**
 * Two columns from lg up: who you are and how to reach you on the left;
 * where you are, languages and workshop capacity on the right. One column
 * on smaller screens, in the same order.
 */
export function ProfileEditor({
  lang,
  p,
  d,
  garage,
  identityLocked,
  weeklyHours,
}: {
  lang: Locale;
  p: ProfileDictionary;
  d: FieldDictionary;
  garage: ProfileGarage;
  identityLocked: boolean;
  weeklyHours: DayHours[];
}) {
  const languages = garage.languages_spoken ?? [];

  return (
    <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
      <div className="flex flex-col gap-5">
        <ProfileSection section="details" lang={lang} title={p.detailsTitle} description={p.detailsDescription} p={p}>
          {(errors) => <DetailsFields garage={garage} d={d} p={p} identityLocked={identityLocked} errors={errors} />}
        </ProfileSection>
        <OpeningHoursSummary lang={lang} d={d} p={p} weeklyHours={weeklyHours} />
      </div>

      <div className="flex flex-col gap-5">
        <ProfileSection section="location" lang={lang} title={p.addressTitle} description={p.locationDescription} p={p}>
          {(errors) => (
            <div className="flex flex-col gap-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-[2fr_1fr]">
                <Field id="address" label={d.addressLabel} error={errors.address}>
                  <input id="address" name="address" autoComplete="street-address" defaultValue={garage.address ?? ""} className={inputClass} />
                </Field>
                <Field id="city" label={d.cityLabel} error={errors.city}>
                  <input id="city" name="city" autoComplete="address-level2" defaultValue={garage.city ?? ""} className={inputClass} />
                </Field>
              </div>
              <GarageMapPicker initialLatitude={garage.latitude} initialLongitude={garage.longitude} />
            </div>
          )}
        </ProfileSection>

        <ProfileSection
          section="capabilities"
          lang={lang}
          title={p.capacityTitle}
          description={p.capabilitiesDescription}
          p={p}
        >
          {(errors) => (
            <div className="flex flex-col gap-5">
              <fieldset className="flex flex-col gap-2.5">
                <legend className={`${labelClass} mb-2`}>{d.languagesSpokenLabel}</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                  {GARAGE_LANGUAGES.map((language) => (
                    <CheckboxChip
                      key={language}
                      name="languages"
                      value={language}
                      label={d.languageLabels[language]}
                      defaultChecked={languages.includes(language)}
                    />
                  ))}
                </div>
              </fieldset>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field id="technicianCount" label={d.technicianCountLabel} error={errors.technicianCount}>
                  <input
                    id="technicianCount"
                    name="technicianCount"
                    type="number"
                    min="0"
                    inputMode="numeric"
                    defaultValue={garage.technician_count ?? ""}
                    className={inputClass}
                  />
                </Field>
                <Field id="pricingCategory" label={d.pricingCategoryLabel} error={errors.pricingCategory}>
                  <StyledSelect id="pricingCategory" name="pricingCategory" defaultValue={garage.pricing_category ?? ""}>
                    <option value="">{d.pricingNotSet}</option>
                    <option value="budget">{d.pricingBudget}</option>
                    <option value="standard">{d.pricingStandard}</option>
                    <option value="premium">{d.pricingPremium}</option>
                  </StyledSelect>
                </Field>
              </div>

              <fieldset className="flex flex-col gap-2.5">
                <legend className={`${labelClass} mb-2`}>{p.servicesOfferedLabel}</legend>
                <div className="flex flex-wrap gap-x-5 gap-y-2.5">
                  <CheckboxChip name="evCapable" label={d.evCapableLabel} defaultChecked={garage.ev_capable} />
                  <CheckboxChip name="mobileService" label={d.mobileServiceLabel} defaultChecked={garage.mobile_service} />
                  <CheckboxChip name="emergencyService" label={d.emergencyServiceLabel} defaultChecked={garage.emergency_service} />
                </div>
              </fieldset>
            </div>
          )}
        </ProfileSection>
      </div>
    </div>
  );
}
