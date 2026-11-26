"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft } from "lucide-react";
import { requestPasswordReset } from "@/app/actions/auth";
import {
  AUTH_INPUT,
  AUTH_SUBMIT,
  AuthField,
  AuthHeading,
  AuthNotice,
} from "@/components/auth-form-parts";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

export function ForgotPasswordForm({ lang, dictionary }: { lang: Locale; dictionary: Dictionary }) {
  const [state, action, pending] = useActionState(requestPasswordReset, undefined);
  const a = dictionary.auth;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="lang" value={lang} />

      <AuthHeading title={a.forgotPassword.title} description={a.forgotPassword.description} />

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
          placeholder="jane@example.com"
          className={AUTH_INPUT}
        />
      </AuthField>

      {/* "Sent" reads the same whether or not the address has an account,
          so the form can't be used to find out which emails are registered. */}
      {state?.sent ? (
        <AuthNotice tone="success">{a.forgotPassword.sent}</AuthNotice>
      ) : (
        state?.message && <AuthNotice tone="error">{state.message}</AuthNotice>
      )}

      <button disabled={pending} aria-busy={pending} type="submit" className={AUTH_SUBMIT}>
        {pending ? a.forgotPassword.submitPending : a.forgotPassword.submit}
      </button>

      <Link
        href={`/${lang}/login`}
        className="inline-flex items-center gap-1.5 self-start text-sm font-semibold text-ink-muted transition-colors hover:text-ink"
      >
        <ArrowLeft aria-hidden className="h-4 w-4" strokeWidth={2} />
        {a.forgotPassword.backToLogin}
      </Link>
    </form>
  );
}
