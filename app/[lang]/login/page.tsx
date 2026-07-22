"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useActionState } from "react";
import { login } from "@/app/actions/auth";
import { AnimatedLogo } from "@/components/animated-logo";

function SignupConfirmNotice() {
  const searchParams = useSearchParams();
  if (searchParams.get("confirm") !== "1") return null;

  return (
    <p className="text-sm text-green-700 dark:text-green-500">
      Check your email to confirm your account before logging in.
    </p>
  );
}

export default function LoginPage() {
  const [state, action, pending] = useActionState(login, undefined);
  const { lang } = useParams<{ lang: string }>();

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
          Trusted garages, one booking away.
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 py-16 dark:bg-black">
        <Link href={`/${lang}`} className="lg:hidden">
          <AnimatedLogo size={48} />
        </Link>
        <form
          action={action}
          className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
        >
          <input type="hidden" name="lang" value={lang} />

          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            Log in
          </h1>

          <Suspense fallback={null}>
            <SignupConfirmNotice />
          </Suspense>

          <div className="flex flex-col gap-1">
            <label htmlFor="email" className="text-sm font-medium">
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              placeholder="jane@example.com"
              className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
            />
            {state?.errors?.email && (
              <p className="text-sm text-red-600">{state.errors.email[0]}</p>
            )}
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between">
              <label htmlFor="password" className="text-sm font-medium">
                Password
              </label>
              <Link
                href={`/${lang}/forgot-password`}
                className="text-sm font-medium underline"
              >
                Forgot password?
              </Link>
            </div>
            <input
              id="password"
              name="password"
              type="password"
              className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
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
            className="mt-2 rounded-full bg-brand-600 px-5 py-2 text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            {pending ? "Logging in..." : "Log In"}
          </button>

          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Don&apos;t have an account?{" "}
            <Link href={`/${lang}/signup`} className="font-medium underline">
              Sign up
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
