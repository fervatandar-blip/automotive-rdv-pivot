"use client";

import { useActionState } from "react";
import { Check } from "lucide-react";
import {
  updateNotificationPreferences,
  updateProfileDetails,
  type NotificationPrefsState,
  type ProfileDetailsState,
} from "@/app/actions/profile";
import { SubmitButton } from "@/components/submit-button";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type D = Dictionary["account"];

const INPUT =
  "w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:focus:border-brand-500";
const LABEL = "text-sm font-medium text-ink";
const HINT = "text-xs text-ink-muted";
const SAVE_BUTTON =
  "inline-flex h-9 items-center rounded-lg bg-brand-600 px-4 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60";

function FieldError({ keys, d }: { keys?: string[]; d: D }) {
  if (!keys?.length) return null;
  return (
    <p role="alert" className="text-xs text-red-600 dark:text-red-400">
      {d.errors[keys[0] as keyof D["errors"]] ?? d.errors.generic}
    </p>
  );
}

function SaveStatus({ status, d }: { status?: "saved" | "error"; d: D }) {
  if (status === "saved") {
    return (
      <p role="status" className="inline-flex items-center gap-1 text-sm text-green-700 dark:text-green-400">
        <Check aria-hidden className="h-4 w-4" strokeWidth={2.25} />
        {d.saved}
      </p>
    );
  }
  if (status === "error") {
    return (
      <p role="alert" className="text-sm text-red-600 dark:text-red-400">
        {d.errors.generic}
      </p>
    );
  }
  return null;
}

export function ProfileDetailsForm({
  d,
  fullName,
  email,
  phone,
}: {
  d: D;
  fullName: string;
  email: string;
  phone: string | null;
}) {
  const [state, action] = useActionState<ProfileDetailsState, FormData>(updateProfileDetails, undefined);

  return (
    <form action={action} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label htmlFor="fullName" className={LABEL}>
          {d.fullName}
        </label>
        <input
          id="fullName"
          name="fullName"
          defaultValue={fullName}
          autoComplete="name"
          required
          maxLength={120}
          aria-invalid={Boolean(state?.errors?.fullName)}
          className={INPUT}
        />
        <FieldError keys={state?.errors?.fullName} d={d} />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className={LABEL}>
          {d.email}
        </label>
        <input id="email" value={email} readOnly disabled className={`${INPUT} opacity-70`} />
        <p className={HINT}>{d.emailHint}</p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="phone" className={LABEL}>
          {d.phone} <span className="font-normal text-ink-muted">({d.optional})</span>
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          defaultValue={phone ?? ""}
          placeholder="+352 621 123 456"
          maxLength={40}
          aria-invalid={Boolean(state?.errors?.phone)}
          aria-describedby="phone-hint"
          className={INPUT}
        />
        <p id="phone-hint" className={HINT}>
          {d.phoneHint}
        </p>
        <FieldError keys={state?.errors?.phone} d={d} />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel={d.saving} className={SAVE_BUTTON}>
          {d.save}
        </SubmitButton>
        <SaveStatus status={state?.status} d={d} />
      </div>
    </form>
  );
}

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-3">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-ink">{label}</span>
        <span className="block text-sm text-ink-muted">{description}</span>
      </span>
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 shrink-0 accent-brand-600"
      />
    </label>
  );
}

export function NotificationPrefsForm({
  d,
  repairUpdates,
  waitlist,
}: {
  d: D;
  repairUpdates: boolean;
  waitlist: boolean;
}) {
  const [state, action] = useActionState<NotificationPrefsState, FormData>(
    updateNotificationPreferences,
    undefined
  );

  return (
    <form action={action} className="flex flex-col gap-3">
      <div className="divide-y divide-hairline">
        <Toggle
          name="repairUpdates"
          label={d.notifyRepairUpdates}
          description={d.notifyRepairUpdatesDescription}
          defaultChecked={repairUpdates}
        />
        <Toggle
          name="waitlist"
          label={d.notifyWaitlist}
          description={d.notifyWaitlistDescription}
          defaultChecked={waitlist}
        />
      </div>
      <p className={HINT}>{d.notifyAlwaysSent}</p>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingLabel={d.saving} className={SAVE_BUTTON}>
          {d.savePreferences}
        </SubmitButton>
        <SaveStatus status={state?.status} d={d} />
      </div>
    </form>
  );
}
