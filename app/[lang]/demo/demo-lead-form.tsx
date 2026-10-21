"use client";

import { useActionState } from "react";
import { ChevronDown } from "lucide-react";
import { submitGarageLead } from "@/app/actions/leads";
import {
  CALLING_CODES,
  COUNTRIES,
  COUNTRY_NAMES,
} from "@/lib/business-registration";
import { GARAGE_SIZE_TYPES, GARAGE_SIZE_TYPE_LABELS } from "@/lib/definitions";
import { StyledSelect } from "@/components/styled-select";

type DemoLeadFormDictionary = {
  successTitle: string;
  successDescription: string;
  scheduleCall: string;
  willBeInTouch: string;
  firstName: string;
  lastName: string;
  businessEmail: string;
  phone: string;
  countryCode: string;
  garageName: string;
  country: string;
  garageSizeType: string;
  selectAnOption: string;
  additionalDetails: string;
  additionalDetailsPlaceholder: string;
  submit: string;
  submitPending: string;
};

export function DemoLeadForm({
  dictionary: d,
}: {
  dictionary: DemoLeadFormDictionary;
}) {
  const [state, action, pending] = useActionState(submitGarageLead, undefined);

  if (state?.success) {
    const bookingUrl = process.env.NEXT_PUBLIC_DEMO_BOOKING_URL;

    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border-2 border-brand-600/15 bg-white p-8 text-center shadow-xl shadow-brand-600/5 dark:border-brand-500/20 dark:bg-zinc-950 dark:shadow-brand-500/10">
        <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
          {d.successTitle}
        </h2>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          {d.successDescription}
        </p>
        {bookingUrl ? (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            {d.scheduleCall}
          </a>
        ) : (
          <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            {d.willBeInTouch}
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-2xl border-2 border-brand-600/15 bg-white p-8 shadow-xl shadow-brand-600/5 dark:border-brand-500/20 dark:bg-zinc-950 dark:shadow-brand-500/10"
    >
      {state?.formError && (
        <p className="text-sm text-red-600">{state.formError}</p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="firstName" className="text-sm font-medium">
            {d.firstName}
          </label>
          <input
            id="firstName"
            name="firstName"
            type="text"
            autoComplete="given-name"
            className="rounded-md border border-black/[.08] px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.firstName && (
            <p className="text-sm text-red-600">{state.errors.firstName[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lastName" className="text-sm font-medium">
            {d.lastName}
          </label>
          <input
            id="lastName"
            name="lastName"
            type="text"
            autoComplete="family-name"
            className="rounded-md border border-black/[.08] px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.lastName && (
            <p className="text-sm text-red-600">{state.errors.lastName[0]}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="businessEmail" className="text-sm font-medium">
            {d.businessEmail}
          </label>
          <input
            id="businessEmail"
            name="businessEmail"
            type="email"
            autoComplete="email"
            placeholder="you@yourgarage.lu"
            className="rounded-md border border-black/[.08] px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.businessEmail && (
            <p className="text-sm text-red-600">{state.errors.businessEmail[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-sm font-medium">
            {d.phone}
          </label>
          <div className="flex">
            <div className="relative shrink-0">
              <select
                name="phoneCountryCode"
                defaultValue="+352"
                aria-label={d.countryCode}
                className="h-full appearance-none rounded-l-md border border-r-0 border-black/[.08] bg-white py-2 pl-3 pr-7 text-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-white/[.145] dark:bg-black"
              >
                {COUNTRIES.map((code) => (
                  <option key={code} value={CALLING_CODES[code]}>
                    {CALLING_CODES[code]}
                  </option>
                ))}
              </select>
              <ChevronDown
                aria-hidden
                className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500 dark:text-zinc-400"
              />
            </div>
            <input
              id="phone"
              name="phone"
              type="tel"
              autoComplete="tel-national"
              placeholder="621 123 456"
              className="w-full rounded-r-md border border-black/[.08] px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-white/[.145] dark:bg-black"
            />
          </div>
          {state?.errors?.phone && (
            <p className="text-sm text-red-600">{state.errors.phone[0]}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="garageName" className="text-sm font-medium">
            {d.garageName}
          </label>
          <input
            id="garageName"
            name="garageName"
            type="text"
            className="rounded-md border border-black/[.08] px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.garageName && (
            <p className="text-sm text-red-600">{state.errors.garageName[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="country" className="text-sm font-medium">
            {d.country}
          </label>
          <StyledSelect id="country" name="country" defaultValue="LU">
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
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="garageSizeType" className="text-sm font-medium">
          {d.garageSizeType}
        </label>
        <StyledSelect id="garageSizeType" name="garageSizeType" defaultValue="">
          <option value="">{d.selectAnOption}</option>
          {GARAGE_SIZE_TYPES.map((code) => (
            <option key={code} value={code}>
              {GARAGE_SIZE_TYPE_LABELS[code]}
            </option>
          ))}
        </StyledSelect>
        {state?.errors?.garageSizeType && (
          <p className="text-sm text-red-600">{state.errors.garageSizeType[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="message" className="text-sm font-medium">
          {d.additionalDetails}
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder={d.additionalDetailsPlaceholder}
          className="rounded-md border border-black/[.08] px-3 py-2 focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-white/[.145] dark:bg-black"
        />
        {state?.errors?.message && (
          <p className="text-sm text-red-600">{state.errors.message[0]}</p>
        )}
      </div>

      <button
        disabled={pending}
        type="submit"
        className="mt-6 w-full rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-600 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-brand-500"
      >
        {pending ? d.submitPending : d.submit}
      </button>
    </form>
  );
}
