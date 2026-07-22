"use client";

import Link from "next/link";
import { ImageOff } from "lucide-react";
import { useActionState, useState } from "react";
import { completeOnboarding } from "@/app/actions/garage";
import { GarageMapPicker } from "@/components/garage-map-picker";
import { StyledSelect } from "@/components/styled-select";
import { CheckboxChip } from "@/components/checkbox-chip";
import type { Locale } from "@/lib/i18n/config";
import {
  COUNTRIES,
  COUNTRY_NAMES,
  REGISTRATION_CONFIG,
  type Country,
} from "@/lib/business-registration";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const LANGUAGES = ["French", "English", "German", "Luxembourgish", "Portuguese"];

type Garage = {
  id: string;
  name: string;
  description: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  email: string | null;
  country: string;
  registration_number: string | null;
  vat_number: string | null;
  pricing_category: string | null;
  technician_count: number | null;
  ev_capable: boolean;
  mobile_service: boolean;
  emergency_service: boolean;
  languages_spoken: string[] | null;
  opening_hours: Record<
    string,
    { closed: true } | { closed: false; open: string; close: string }
  > | null;
  platform_terms_accepted_at: string | null;
  latitude: number | null;
  longitude: number | null;
};

export function OnboardingForm({
  lang,
  garage,
  brands,
  specialties,
  selectedBrandIds,
  selectedSpecialtyIds,
  justSaved,
}: {
  lang: Locale;
  garage: Garage;
  brands: { id: string; name: string }[];
  specialties: { id: string; name: string }[];
  selectedBrandIds: string[];
  selectedSpecialtyIds: string[];
  justSaved: boolean;
}) {
  const [state, action, pending] = useActionState(
    completeOnboarding,
    undefined
  );
  const isFirstRun = !garage.platform_terms_accepted_at;
  const languages = garage.languages_spoken ?? [];
  const [country, setCountry] = useState<Country>(
    COUNTRIES.includes(garage.country as Country)
      ? (garage.country as Country)
      : "LU"
  );
  const registrationConfig = REGISTRATION_CONFIG[country];

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-12 dark:bg-black sm:px-12">
      <form
        action={action}
        className="mx-auto flex w-full max-w-2xl flex-col gap-8"
      >
        <input type="hidden" name="lang" value={lang} />

        <div>
          {/* Pre-onboarding, app/[lang]/garage/layout.tsx already renders its
              own "Back to dashboard" link in the minimal header -- only add
              this one once onboarded, where that layout instead shows the
              full sidebar with no such link. */}
          {!isFirstRun && (
            <Link
              href={`/${lang}/dashboard`}
              className="text-sm font-medium underline"
            >
              &larr; Back to dashboard
            </Link>
          )}
          <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
            {isFirstRun ? "Set up your garage" : "Garage profile"}
          </h1>
          {isFirstRun && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              Tell clients about your garage. You can finish uploading
              verification documents right after.
            </p>
          )}
        </div>

        {justSaved && (
          <p className="rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700 dark:border-green-900 dark:bg-green-950 dark:text-green-400">
            Saved.
          </p>
        )}
        {state?.message && (
          <p className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-400">
            {state.message}
          </p>
        )}

        <div className="flex items-center gap-4 rounded-xl border border-dashed border-black/[.15] bg-white p-6 dark:border-white/[.2] dark:bg-zinc-950">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-black/[.04] text-zinc-400 dark:bg-white/[.06] dark:text-zinc-500">
            <ImageOff className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-medium text-black dark:text-zinc-50">
              No logo uploaded yet
            </p>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              Logo uploads aren&apos;t available yet — coming soon.
            </p>
          </div>
        </div>

        <section className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">
            Garage details
          </h2>

          <div className="flex flex-col gap-1">
            <label htmlFor="name" className="text-sm font-medium">
              Name
            </label>
            <input
              id="name"
              name="name"
              defaultValue={garage.name}
              className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
            />
            {state?.errors?.name && (
              <p className="text-sm text-red-600">{state.errors.name[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="description" className="text-sm font-medium">
              Description
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              defaultValue={garage.description ?? ""}
              className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
            />
            {state?.errors?.description && (
              <p className="text-sm text-red-600">
                {state.errors.description[0]}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="address" className="text-sm font-medium">
                Address
              </label>
              <input
                id="address"
                name="address"
                defaultValue={garage.address ?? ""}
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="city" className="text-sm font-medium">
                City
              </label>
              <input
                id="city"
                name="city"
                defaultValue={garage.city ?? ""}
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="phone" className="text-sm font-medium">
                Phone
              </label>
              <input
                id="phone"
                name="phone"
                defaultValue={garage.phone ?? ""}
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="email" className="text-sm font-medium">
                Business email
              </label>
              <input
                id="email"
                name="email"
                type="email"
                defaultValue={garage.email ?? ""}
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              />
              {state?.errors?.email && (
                <p className="text-sm text-red-600">{state.errors.email[0]}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="country" className="text-sm font-medium">
                Country
              </label>
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
              {state?.errors?.country && (
                <p className="text-sm text-red-600">{state.errors.country[0]}</p>
              )}
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="registrationNumber" className="text-sm font-medium">
                {registrationConfig.label}
              </label>
              <input
                id="registrationNumber"
                name="registrationNumber"
                defaultValue={garage.registration_number ?? ""}
                placeholder={registrationConfig.placeholder}
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              />
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                {registrationConfig.hint}
              </p>
              {state?.errors?.registrationNumber && (
                <p className="text-sm text-red-600">
                  {state.errors.registrationNumber[0]}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="vatNumber" className="text-sm font-medium">
              VAT number
            </label>
            <input
              id="vatNumber"
              name="vatNumber"
              defaultValue={garage.vat_number ?? ""}
              placeholder="LU12345678"
              className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
            />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Shown on invoices generated for your clients.
            </p>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">
            Location
          </h2>
          <GarageMapPicker
            initialLatitude={garage.latitude}
            initialLongitude={garage.longitude}
          />
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">
            Opening hours
          </h2>
          <div className="flex flex-col gap-2">
            {DAYS.map((day, index) => {
              const existing = garage.opening_hours?.[index];
              const closed = existing ? existing.closed : index === 0 || index === 6;
              const open = (!existing?.closed && existing?.open) || "09:00";
              const close = (!existing?.closed && existing?.close) || "18:00";

              return (
                <div key={day} className="flex items-center gap-3 text-sm">
                  <span className="w-24 shrink-0">{day}</span>
                  <CheckboxChip
                    name={`hours_${index}_closed`}
                    label="Closed"
                    defaultChecked={closed}
                  />
                  <input
                    type="time"
                    name={`hours_${index}_open`}
                    defaultValue={open}
                    className="rounded-md border border-black/[.08] px-2 py-1 dark:border-white/[.145] dark:bg-black"
                  />
                  <span>&ndash;</span>
                  <input
                    type="time"
                    name={`hours_${index}_close`}
                    defaultValue={close}
                    className="rounded-md border border-black/[.08] px-2 py-1 dark:border-white/[.145] dark:bg-black"
                  />
                </div>
              );
            })}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">
            Services & capabilities
          </h2>

          <div className="flex flex-wrap gap-4 text-sm">
            <CheckboxChip
              name="evCapable"
              label="EV / high-voltage capable"
              defaultChecked={garage.ev_capable}
            />
            <CheckboxChip
              name="mobileService"
              label="Mobile service available"
              defaultChecked={garage.mobile_service}
            />
            <CheckboxChip
              name="emergencyService"
              label="Emergency assistance available"
              defaultChecked={garage.emergency_service}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1">
              <label htmlFor="pricingCategory" className="text-sm font-medium">
                Pricing category
              </label>
              <StyledSelect
                id="pricingCategory"
                name="pricingCategory"
                defaultValue={garage.pricing_category ?? ""}
              >
                <option value="">Not set</option>
                <option value="budget">Budget</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
              </StyledSelect>
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="technicianCount" className="text-sm font-medium">
                Number of technicians
              </label>
              <input
                id="technicianCount"
                name="technicianCount"
                type="number"
                min="0"
                defaultValue={garage.technician_count ?? ""}
                className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
              />
              {state?.errors?.technicianCount && (
                <p className="text-sm text-red-600">
                  {state.errors.technicianCount[0]}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium">Languages spoken</span>
            <div className="flex flex-wrap gap-4 text-sm">
              {LANGUAGES.map((language) => (
                <CheckboxChip
                  key={language}
                  name="languages"
                  value={language}
                  label={language}
                  defaultChecked={languages.includes(language)}
                />
              ))}
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">
            Brands supported
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
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
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">
            Specialties
          </h2>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
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
        </section>

        <section className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">
            Platform verification terms
          </h2>
          <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
            <input
              type="checkbox"
              name="platformTermsAccepted"
              defaultChecked={!isFirstRun}
              required
              className="mt-1"
            />
            <span>
              I agree to upload invoices/services, accept RDV&apos;s verified
              service protocols, consent to the customer verification system,
              and agree to the anti-fraud and transparency rules that keep
              RDV trustworthy for clients and garages alike.
            </span>
          </label>
        </section>

        <button
          disabled={pending}
          type="submit"
          className="self-start rounded-full bg-brand-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
        >
          {pending
            ? "Saving..."
            : isFirstRun
              ? "Complete setup & continue to documents"
              : "Save changes"}
        </button>
      </form>
    </div>
  );
}
