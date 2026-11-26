"use client";

import Link from "next/link";
import { useActionState } from "react";
import { garageSignup } from "@/app/actions/auth";
import {
  AUTH_INPUT,
  AUTH_LINK,
  AUTH_SUBMIT,
  AuthField,
  AuthFooter,
  AuthHeading,
  AuthNotice,
} from "@/components/auth-form-parts";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

export function GarageSignupForm({ lang, dictionary }: { lang: Locale; dictionary: Dictionary }) {
  const [state, action, pending] = useActionState(garageSignup, undefined);
  const a = dictionary.auth;
  const g = dictionary.garageAuth.signup;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="lang" value={lang} />
      {/* No role field: garageSignup sets it server-side (app/actions/auth.ts). */}

      <AuthHeading title={g.title} description={g.description} />

      <div className="flex flex-col gap-4">
        <AuthField id="fullName" label={a.signup.nameLabel} errors={state?.errors?.fullName}>
          <input
            id="fullName"
            name="fullName"
            autoComplete="name"
            required
            aria-invalid={state?.errors?.fullName ? true : undefined}
            aria-describedby={state?.errors?.fullName ? "fullName-error" : undefined}
            placeholder="Jane Doe"
            className={AUTH_INPUT}
          />
        </AuthField>

        <AuthField id="email" label={a.emailLabel} errors={state?.errors?.email}>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            aria-invalid={state?.errors?.email ? true : undefined}
            aria-describedby={state?.errors?.email ? "email-error" : undefined}
            placeholder="jane@yourworkshop.lu"
            className={AUTH_INPUT}
          />
        </AuthField>

        <AuthField id="password" label={a.passwordLabel} errors={state?.errors?.password}>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={state?.errors?.password ? true : undefined}
            aria-describedby={state?.errors?.password ? "password-error" : "password-hint"}
            className={AUTH_INPUT}
          />
          {!state?.errors?.password && (
            <p id="password-hint" className="text-xs text-ink-muted">
              {a.signup.passwordHint}
            </p>
          )}
        </AuthField>
      </div>

      <label className="flex items-start gap-3 text-sm text-ink-muted">
        <input type="checkbox" name="termsAccepted" required className="mt-0.5 h-4 w-4 shrink-0 accent-ink" />
        <span>
          {a.signup.termsPrefix}{" "}
          <Link href={`/${lang}/privacy`} className={AUTH_LINK}>
            {a.signup.termsLink}
          </Link>
          .
        </span>
      </label>

      {state?.message && <AuthNotice tone="error">{state.message}</AuthNotice>}

      <button disabled={pending} aria-busy={pending} type="submit" className={AUTH_SUBMIT}>
        {pending ? g.submitPending : g.submit}
      </button>

      <AuthFooter>
        <p>
          {g.hasAccount}{" "}
          <Link href={`/${lang}/garage/login`} className={AUTH_LINK}>
            {g.logInLink}
          </Link>
        </p>
        <p>
          {g.notGarageOwner}{" "}
          <Link href={`/${lang}/signup`} className={AUTH_LINK}>
            {g.clientSignUpLink}
          </Link>
        </p>
      </AuthFooter>
    </form>
  );
}
