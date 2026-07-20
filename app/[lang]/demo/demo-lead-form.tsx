"use client";

import { useActionState } from "react";
import { submitGarageLead } from "@/app/actions/leads";
import {
  COUNTRIES,
  COUNTRY_NAMES,
} from "@/lib/business-registration";
import { GARAGE_SIZE_TYPES, GARAGE_SIZE_TYPE_LABELS } from "@/lib/definitions";

export function DemoLeadForm() {
  const [state, action, pending] = useActionState(submitGarageLead, undefined);

  if (state?.success) {
    const bookingUrl = process.env.NEXT_PUBLIC_DEMO_BOOKING_URL;

    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-black/[.08] bg-white p-8 text-center dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="text-xl font-semibold text-black dark:text-zinc-50">
          Thank you. Your request has been received.
        </h2>
        <p className="max-w-sm text-sm text-zinc-600 dark:text-zinc-400">
          A member of our team will be in touch shortly to confirm your
          personalized demo. In the meantime, feel free to choose a time that
          suits you.
        </p>
        {bookingUrl ? (
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Schedule your demo call
          </a>
        ) : (
          <p className="mt-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
            We&apos;ll be in touch by email shortly.
          </p>
        )}
      </div>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
    >
      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="firstName" className="text-sm font-medium">
            First name
          </label>
          <input
            id="firstName"
            name="firstName"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.firstName && (
            <p className="text-sm text-red-600">{state.errors.firstName[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="lastName" className="text-sm font-medium">
            Last name
          </label>
          <input
            id="lastName"
            name="lastName"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.lastName && (
            <p className="text-sm text-red-600">{state.errors.lastName[0]}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="businessEmail" className="text-sm font-medium">
            Business email
          </label>
          <input
            id="businessEmail"
            name="businessEmail"
            type="email"
            placeholder="you@yourgarage.lu"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.businessEmail && (
            <p className="text-sm text-red-600">{state.errors.businessEmail[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="phone" className="text-sm font-medium">
            Phone number
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.phone && (
            <p className="text-sm text-red-600">{state.errors.phone[0]}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="garageName" className="text-sm font-medium">
            Garage name
          </label>
          <input
            id="garageName"
            name="garageName"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.garageName && (
            <p className="text-sm text-red-600">{state.errors.garageName[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="country" className="text-sm font-medium">
            Country
          </label>
          <select
            id="country"
            name="country"
            defaultValue="LU"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          >
            {COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {COUNTRY_NAMES[code]}
              </option>
            ))}
          </select>
          {state?.errors?.country && (
            <p className="text-sm text-red-600">{state.errors.country[0]}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="garageSizeType" className="text-sm font-medium">
          Garage size/type
        </label>
        <select
          id="garageSizeType"
          name="garageSizeType"
          defaultValue=""
          className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        >
          <option value="">Select an option</option>
          {GARAGE_SIZE_TYPES.map((code) => (
            <option key={code} value={code}>
              {GARAGE_SIZE_TYPE_LABELS[code]}
            </option>
          ))}
        </select>
        {state?.errors?.garageSizeType && (
          <p className="text-sm text-red-600">{state.errors.garageSizeType[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="message" className="text-sm font-medium">
          Tell us about your needs or any questions you have
        </label>
        <textarea
          id="message"
          name="message"
          rows={4}
          placeholder="How many bays, what services you offer, anything you'd like us to know before the call..."
          className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
        {state?.errors?.message && (
          <p className="text-sm text-red-600">{state.errors.message[0]}</p>
        )}
      </div>

      <button
        disabled={pending}
        type="submit"
        className="mt-2 rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {pending ? "Submitting..." : "Book my free demo"}
      </button>
    </form>
  );
}
