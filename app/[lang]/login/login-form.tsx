"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { login } from "@/app/actions/auth";
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

function SignupConfirmNotice({ message }: { message: string }) {
  const searchParams = useSearchParams();
  if (searchParams.get("confirm") !== "1") return null;
  return <AuthNotice tone="success">{message}</AuthNotice>;
}

/**
 * Sign-in for clients and workshops alike: login() sends each account to
 * its own home from the role stored in the database, whichever page was
 * used. `audience` only changes the wording and the cross-links.
 */
export function LoginForm({
  lang,
  dictionary,
  audience = "client",
}: {
  lang: Locale;
  dictionary: Dictionary;
  audience?: "client" | "workshop";
}) {
  const [state, action, pending] = useActionState(login, undefined);
  const a = dictionary.auth;
  const workshop = audience === "workshop";

  return (
    <form action={action} className="flex flex-col gap-6" noValidate>
      <input type="hidden" name="lang" value={lang} />

      <AuthHeading title={workshop ? dictionary.garageAuth.login.title : a.login.title} />

      <Suspense fallback={null}>
        <SignupConfirmNotice
          message={workshop ? dictionary.garageAuth.login.confirmEmailNotice : a.login.confirmEmailNotice}
        />
      </Suspense>

      <div className="flex flex-col gap-4">
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
            placeholder={workshop ? "jane@yourworkshop.lu" : "jane@example.com"}
            className={AUTH_INPUT}
          />
        </AuthField>

        <AuthField
          id="password"
          label={a.passwordLabel}
          errors={state?.errors?.password}
          aside={
            <Link href={`/${lang}/forgot-password`} className="text-sm font-semibold text-ink-muted hover:text-ink">
              {a.login.forgotPassword}
            </Link>
          }
        >
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            aria-invalid={state?.errors?.password ? true : undefined}
            aria-describedby={state?.errors?.password ? "password-error" : undefined}
            className={AUTH_INPUT}
          />
        </AuthField>
      </div>

      {state?.message && <AuthNotice tone="error">{state.message}</AuthNotice>}

      <button disabled={pending} aria-busy={pending} type="submit" className={AUTH_SUBMIT}>
        {pending ? a.login.submitPending : a.login.submit}
      </button>

      <AuthFooter>
        {workshop ? (
          <>
            <p>
              {dictionary.garageAuth.login.noAccount}{" "}
              <Link href={`/${lang}/demo`} className={AUTH_LINK}>
                {dictionary.home.partnerCta}
              </Link>
            </p>
            <p>
              {dictionary.garageAuth.login.notGarageOwner}{" "}
              <Link href={`/${lang}/login`} className={AUTH_LINK}>
                {dictionary.garageAuth.login.clientLoginLink}
              </Link>
            </p>
          </>
        ) : (
          <>
            <p>
              {a.login.noAccount}{" "}
              <Link href={`/${lang}/signup`} className={AUTH_LINK}>
                {a.login.signUpLink}
              </Link>
            </p>
            <p>
              {a.login.workshopPrompt}{" "}
              <Link href={`/${lang}/garage/login`} className={AUTH_LINK}>
                {dictionary.home.partnerLogin}
              </Link>
            </p>
          </>
        )}
      </AuthFooter>
    </form>
  );
}
