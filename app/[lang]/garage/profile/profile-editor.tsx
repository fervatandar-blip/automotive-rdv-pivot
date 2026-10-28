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
  "w-full rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black";

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
    <form
      action={action}
      aria-labelledby={`section-${section}-title`}
      className="flex flex-col gap-5 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
    >
      <input type="hidden" name="lang" value={lang} />
      <input type="hidden" name="section" value={section} />

      <div>
        <h2
          id={`section-${section}-title`}
          className="font-semibold text-black dark:text-zinc-50"
        >
          {title}
        </h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
      </div>

      {children(errors)}

      <div className="flex flex-wrap items-center gap-3 border-t border-black/[.06] pt-4 dark:border-white/[.1]">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {pending ? p.saving : p.save}
        </button>
        {!pending && state?.savedAt && (
          <span
            role="status"
            className="flex items-center gap-1 text-sm text-green-700 dark:text-green-500"
          >
            <Check className="h-4 w-4" strokeWidth={2.5} />
            {p.saved}
          </span>
        )}
        {!pending && state?.message && (
          <span role="alert" className="text-sm text-red-600">
            {state.message}
          </span>
        )}
      </div>
    </form>
  );
}

function FieldError({ messages }: { messages?: string[] }) {
  if (!messages?.length) return null;
  return <p className="text-sm text-red-600">{messages[0]}</p>;
}

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
  const [descriptionLength, setDescriptionLength] = useState(
    garage.description?.length ?? 0
  );
  const registrationConfig = REGISTRATION_CONFIG[country];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          {d.nameLabel}
        </label>
        <input id="name" name="name" required minLength={2} defaultValue={garage.name} className={inputClass} />
        <FieldError messages={errors.name} />
      </div>

      <div className="flex flex-col gap-1">
        <div className="flex items-baseline justify-between">
          <label htmlFor="description" className="text-sm font-medium">
            {d.descriptionLabel}
          </label>
          <span
            className={`text-xs ${
              descriptionLength > GARAGE_DESCRIPTION_MAX_LENGTH
                ? "text-red-600"
                : "text-zinc-500 dark:text-zinc-400"
            }`}
          >
            {descriptionLength}/{GARAGE_DESCRIPTION_MAX_LENGTH}
          </span>
        </div>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={garage.description ?? ""}
          onChange={(event) => setDescriptionLength(event.target.value.length)}
          placeholder={p.descriptionPlaceholder}
          className={inputClass}
        />
        <FieldError messages={errors.description} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="address" className="text-sm font-medium">
            {d.addressLabel}
          </label>
          <input id="address" name="address" autoComplete="street-address" defaultValue={garage.address ?? ""} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="city" className="text-sm font-medium">
            {d.cityLabel}
          </label>
          <input id="city" name="city" autoComplete="address-level2" defaultValue={garage.city ?? ""} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-sm font-medium">
            {d.phoneLabel}
          </label>
          <input id="phone" name="phone" type="tel" autoComplete="tel" defaultValue={garage.phone ?? ""} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            {d.businessEmailLabel}
          </label>
          <input id="email" name="email" type="email" autoComplete="email" defaultValue={garage.email ?? ""} className={inputClass} />
          <FieldError messages={errors.email} />
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="website" className="text-sm font-medium">
          {d.websiteLabel}
        </label>
        <input
          id="website"
          name="website"
          type="url"
          placeholder="https://yourgarage.lu"
          defaultValue={garage.website ?? ""}
          className={inputClass}
        />
        <FieldError messages={errors.website} />
      </div>

      <fieldset className="flex flex-col gap-4 rounded-lg bg-zinc-50 p-4 dark:bg-white/[.03]">
        <legend className="sr-only">{p.legalTitle}</legend>
        <p className="text-sm font-medium text-black dark:text-zinc-50">{p.legalTitle}</p>
        {identityLocked && (
          <p className="flex items-start gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.75} />
            {p.legalLockedNote}
          </p>
        )}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="country" className="text-sm font-medium">
              {d.countryLabel}
            </label>
            {identityLocked ? (
              <input id="country" readOnly value={COUNTRY_NAMES[country]} className={`${inputClass} text-zinc-500`} />
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
            <FieldError messages={errors.country} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="registrationNumber" className="text-sm font-medium">
              {registrationConfig.label}
            </label>
            <input
              id="registrationNumber"
              name={identityLocked ? undefined : "registrationNumber"}
              readOnly={identityLocked}
              defaultValue={garage.registration_number ?? ""}
              placeholder={registrationConfig.placeholder}
              className={`${inputClass} ${identityLocked ? "text-zinc-500" : ""}`}
            />
            {!identityLocked && (
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{registrationConfig.hint}</p>
            )}
            <FieldError messages={errors.registrationNumber} />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="vatNumber" className="text-sm font-medium">
            {d.vatNumberLabel}
          </label>
          <input
            id="vatNumber"
            name="vatNumber"
            defaultValue={garage.vat_number ?? ""}
            placeholder="LU12345678"
            className={inputClass}
          />
          <p className="text-xs text-zinc-500 dark:text-zinc-400">{d.vatNumberHint}</p>
        </div>
      </fieldset>
    </div>
  );
}

export function ProfileEditor({
  lang,
  p,
  d,
  garage,
  identityLocked,
  brands,
  specialties,
  selectedBrandIds,
  selectedSpecialtyIds,
  weeklyHours,
}: {
  lang: Locale;
  p: ProfileDictionary;
  d: FieldDictionary;
  garage: ProfileGarage;
  identityLocked: boolean;
  brands: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  selectedBrandIds: string[];
  selectedSpecialtyIds: string[];
  weeklyHours: DayHours[];
}) {
  const languages = garage.languages_spoken ?? [];
  const hasHours = weeklyHours.some((day) => day.ranges.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <ProfileSection section="details" lang={lang} title={d.garageDetails} description={p.detailsDescription} p={p}>
        {(errors) => (
          <DetailsFields garage={garage} d={d} p={p} identityLocked={identityLocked} errors={errors} />
        )}
      </ProfileSection>

      <section
        aria-labelledby="section-hours-title"
        className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 id="section-hours-title" className="font-semibold text-black dark:text-zinc-50">
              {d.openingHoursTitle}
            </h2>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{p.hoursDescription}</p>
          </div>
          <Link
            href={`/${lang}/garage/availability`}
            className="shrink-0 rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            {p.manageHours}
          </Link>
        </div>
        {hasHours ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-1.5 text-sm">
            {weeklyHours.map((day) => (
              <div key={day.dayOfWeek} className="contents">
                <dt className="text-zinc-600 dark:text-zinc-400">{d.days[day.dayOfWeek]}</dt>
                <dd className="font-medium text-black dark:text-zinc-50">
                  {day.ranges.length > 0 ? day.ranges.join(", ") : d.closed}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-400">
            {p.noHours}
          </p>
        )}
      </section>

      <ProfileSection section="location" lang={lang} title={d.locationTitle} description={p.locationDescription} p={p}>
        {() => (
          <GarageMapPicker initialLatitude={garage.latitude} initialLongitude={garage.longitude} />
        )}
      </ProfileSection>

      <ProfileSection
        section="capabilities"
        lang={lang}
        title={d.servicesCapabilitiesTitle}
        description={p.capabilitiesDescription}
        p={p}
      >
        {(errors) => (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <CheckboxChip name="evCapable" label={d.evCapableLabel} defaultChecked={garage.ev_capable} />
              <CheckboxChip name="mobileService" label={d.mobileServiceLabel} defaultChecked={garage.mobile_service} />
              <CheckboxChip name="emergencyService" label={d.emergencyServiceLabel} defaultChecked={garage.emergency_service} />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="pricingCategory" className="text-sm font-medium">
                  {d.pricingCategoryLabel}
                </label>
                <StyledSelect id="pricingCategory" name="pricingCategory" defaultValue={garage.pricing_category ?? ""}>
                  <option value="">{d.pricingNotSet}</option>
                  <option value="budget">{d.pricingBudget}</option>
                  <option value="standard">{d.pricingStandard}</option>
                  <option value="premium">{d.pricingPremium}</option>
                </StyledSelect>
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="technicianCount" className="text-sm font-medium">
                  {d.technicianCountLabel}
                </label>
                <input
                  id="technicianCount"
                  name="technicianCount"
                  type="number"
                  min="0"
                  inputMode="numeric"
                  defaultValue={garage.technician_count ?? ""}
                  className={inputClass}
                />
                <FieldError messages={errors.technicianCount} />
              </div>
            </div>

            <fieldset className="flex flex-col gap-2">
              <legend className="text-sm font-medium">{d.languagesSpokenLabel}</legend>
              <div className="flex flex-wrap gap-x-6 gap-y-3">
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
          </div>
        )}
      </ProfileSection>

      <ProfileSection section="catalog" lang={lang} title={p.catalogTitle} description={p.catalogDescription} p={p}>
        {() => (
          <div className="flex flex-col gap-6">
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-medium">{d.brandsSupportedTitle}</legend>
              <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
                {brands.map((brand) => (
                  <CheckboxChip
                    key={brand.id}
                    name="brandIds"
                    value={brand.id}
                    label={brand.name}
                    defaultChecked={selectedBrandIds.includes(brand.id)}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-3">
              <legend className="text-sm font-medium">{d.specialtiesTitle}</legend>
              <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
                {specialties.map((specialty) => (
                  <CheckboxChip
                    key={specialty.id}
                    name="specialtyIds"
                    value={specialty.id}
                    label={specialty.name}
                    defaultChecked={selectedSpecialtyIds.includes(specialty.id)}
                  />
                ))}
              </div>
            </fieldset>
          </div>
        )}
      </ProfileSection>
    </div>
  );
}
