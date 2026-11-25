"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { login } from "@/app/actions/auth";
import { AnimatedLogo } from "@/components/animated-logo";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

function SignupConfirmNotice({ message }: { message: string }) {
  const searchParams = useSearchParams();
  if (searchParams.get("confirm") !== "1") return null;

  return <p className="text-sm text-green-700 dark:text-green-500">{message}</p>;
}

// Reuses the shared login() action unchanged -- it already redirects based
// on the account's actual role read from the database
// (admin_garage/mecanicien -> /garage/dashboard, client -> /dashboard), not
// on which login page was used, so this page needs no garage-specific
// auth logic of its own. This is purely a dedicated, garage-branded entry
// point into that same, already-safe flow.
export function GarageLoginForm({
  lang,
  dictionary,
}: {
  lang: Locale;
  dictionary: Dictionary;
}) {
  const [state, action, pending] = useActionState(login, undefined);

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
            {dictionary.garageAuth.login.title}
          </h1>

          <Suspense fallback={null}>
            <SignupConfirmNotice
              message={dictionary.garageAuth.login.confirmEmailNotice}
            />
          </Suspense>

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
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                {dictionary.auth.passwordLabel}
              </label>
              <Link
                href={`/${lang}/forgot-password`}
                className="text-sm font-medium underline"
              >
                {dictionary.auth.login.forgotPassword}
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              className="rounded-md border border-hairline px-3 py-2 bg-surface"
            />
            {state?.errors?.password && (
              <p className="text-sm text-red-600">
                {state.errors.password[0]}
              </p>
            )}
          </div>

          {state?.message && (
            <p className="text-sm text-red-600">{state.message}</p>
          )}

          <button
            disabled={pending}
            type="submit"
            className="mt-2 rounded-xl bg-ink px-5 py-2.5 text-surface transition-colors hover:bg-ink/85 disabled:opacity-50"
          >
            {pending
              ? dictionary.garageAuth.login.submitPending
              : dictionary.garageAuth.login.submit}
          </button>

          <p className="text-sm text-ink-muted">
            {dictionary.garageAuth.login.noAccount}{" "}
            <Link
              href={`/${lang}/garage/signup`}
              className="font-medium underline"
            >
              {dictionary.garageAuth.login.signUpLink}
            </Link>
          </p>

          <p className="text-sm text-ink-muted">
            {dictionary.garageAuth.login.notGarageOwner}{" "}
            <Link href={`/${lang}/login`} className="font-medium underline">
              {dictionary.garageAuth.login.clientLoginLink}
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
