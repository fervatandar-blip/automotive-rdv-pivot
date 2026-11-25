"use client";

import Link from "next/link";
import { useActionState } from "react";
import { garageSignup } from "@/app/actions/auth";
import { AnimatedLogo } from "@/components/animated-logo";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

// No hidden "role" input anywhere in this form -- garageSignup()
// (app/actions/auth.ts) never reads a role field from submitted form data
// at all; it hardcodes role: "admin_garage" in its own code. See that
// action's comment and GarageSignupFormSchema (lib/definitions.ts) for the
// full anti-escalation design.
export function GarageSignupForm({
  lang,
  dictionary,
}: {
  lang: Locale;
  dictionary: Dictionary;
}) {
  const [state, action, pending] = useActionState(garageSignup, undefined);

  return (
    <div className="flex flex-1 flex-col lg:grid lg:grid-cols-2">
      <div className="relative hidden flex-col items-center justify-center overflow-hidden bg-zinc-950 px-12 lg:flex">
        <div
          aria-hidden
          className="absolute h-64 w-64 rounded-full bg-brand-500/10 blur-3xl"
        />
        <div
          aria-hidden
          className="absolute h-40 w-px rotate-45 bg-brand-500/30"
        />
        <div
          aria-hidden
          className="absolute h-40 w-px -rotate-45 bg-brand-500/30"
        />
        <AnimatedLogo size={160} className="relative z-10" />
        <p className="relative z-10 mt-6 text-center text-zinc-400">
          {dictionary.garageAuth.tagline}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-canvas px-4 py-16">
        <Link href={`/${lang}`} className="lg:hidden">
          <AnimatedLogo size={48} />
        </Link>
        <form
          action={action}
          className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-8"
        >
          <input type="hidden" name="lang" value={lang} />

          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {dictionary.garageAuth.signup.title}
          </h1>
          <p className="text-sm text-ink-muted">
            {dictionary.garageAuth.signup.description}
          </p>

          <div className="flex flex-col gap-1">
            <label htmlFor="fullName" className="text-sm font-medium">
              {dictionary.auth.signup.nameLabel}
            </label>
            <input
              id="fullName"
              name="fullName"
              placeholder="Jane Doe"
              className="rounded-md border border-hairline px-3 py-2 bg-surface"
            />
            {state?.errors?.fullName && (
              <p className="text-sm text-red-600">
                {state.errors.fullName[0]}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              {dictionary.auth.emailLabel}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="jane@yourworkshop.lu"
              className="rounded-md border border-hairline px-3 py-2 bg-surface"
            />
            {state?.errors?.email && (
              <p className="text-sm text-red-600">{state.errors.email[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <label htmlFor="password" className="text-sm font-medium">
              {dictionary.auth.passwordLabel}
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="rounded-md border border-hairline px-3 py-2 bg-surface"
            />
            {state?.errors?.password && (
              <ul className="text-sm text-red-600">
                {state.errors.password.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )}
          </div>

          <label className="flex items-start gap-2 text-sm text-ink">
            <input
              type="checkbox"
              name="termsAccepted"
              required
              className="mt-1"
            />
            <span>
              {dictionary.auth.signup.termsPrefix}{" "}
              <Link href={`/${lang}/privacy`} className="underline">
                {dictionary.auth.signup.termsLink}
              </Link>
              .
            </span>
          </label>

          {state?.message && (
            <p className="text-sm text-red-600">{state.message}</p>
          )}

          <button
            disabled={pending}
            type="submit"
            className="mt-2 rounded-xl bg-ink px-5 py-2.5 text-surface transition-colors hover:bg-ink/85 disabled:opacity-50"
          >
            {pending
              ? dictionary.garageAuth.signup.submitPending
              : dictionary.garageAuth.signup.submit}
          </button>

          <p className="text-sm text-ink-muted">
            {dictionary.garageAuth.signup.hasAccount}{" "}
            <Link
              href={`/${lang}/garage/login`}
              className="font-medium underline"
            >
              {dictionary.garageAuth.signup.logInLink}
            </Link>
          </p>

          <p className="text-sm text-ink-muted">
            {dictionary.garageAuth.signup.notGarageOwner}{" "}
            <Link href={`/${lang}/signup`} className="font-medium underline">
              {dictionary.garageAuth.signup.clientSignUpLink}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
