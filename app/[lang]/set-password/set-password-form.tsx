"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { setPassword } from "@/app/actions/auth";
import { AUTH_INPUT, AUTH_SUBMIT, AuthField, AuthHeading, AuthNotice } from "@/components/auth-form-parts";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

function SetPasswordCopy({ d }: { d: Dictionary["setPassword"] }) {
  const searchParams = useSearchParams();
  const isRecovery = searchParams.get("context") === "recovery";
  return (
    <AuthHeading
      title={isRecovery ? d.recoveryTitle : d.setTitle}
      description={isRecovery ? d.recoveryDescription : d.inviteDescription}
    />
  );
}

export function SetPasswordForm({ lang, dictionary }: { lang: Locale; dictionary: Dictionary }) {
  const [state, action, pending] = useActionState(setPassword, undefined);
  const d = dictionary.setPassword;

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="lang" value={lang} />

      <Suspense fallback={<AuthHeading title={d.setTitle} />}>
        <SetPasswordCopy d={d} />
      </Suspense>

      <div className="flex flex-col gap-4">
        <AuthField id="password" label={d.passwordLabel} errors={state?.errors?.password}>
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
              {dictionary.auth.signup.passwordHint}
            </p>
          )}
        </AuthField>

        <AuthField id="confirmPassword" label={d.confirmPasswordLabel} errors={state?.errors?.confirmPassword}>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            required
            aria-invalid={state?.errors?.confirmPassword ? true : undefined}
            aria-describedby={state?.errors?.confirmPassword ? "confirmPassword-error" : undefined}
            className={AUTH_INPUT}
          />
        </AuthField>
      </div>

      {state?.message && <AuthNotice tone="error">{state.message}</AuthNotice>}

      <button disabled={pending} aria-busy={pending} type="submit" className={AUTH_SUBMIT}>
        {pending ? d.submitPending : d.submit}
      </button>
    </form>
  );
}
