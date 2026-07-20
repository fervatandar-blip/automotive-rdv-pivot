"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useParams } from "next/navigation";
import { signup } from "@/app/actions/auth";

export default function SignupPage() {
  const [state, action, pending] = useActionState(signup, undefined);
  const { lang } = useParams<{ lang: string }>();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <form
        action={action}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <input type="hidden" name="lang" value={lang} />
        <input type="hidden" name="role" value="client" />

        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Create an account
        </h1>

        <div className="flex flex-col gap-1">
          <label htmlFor="fullName" className="text-sm font-medium">
            Name
          </label>
          <input
            id="fullName"
            name="fullName"
            placeholder="Jane Doe"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.fullName && (
            <p className="text-sm text-red-600">{state.errors.fullName[0]}</p>
          )}
        </div>

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
          <label htmlFor="password" className="text-sm font-medium">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.password && (
            <ul className="text-sm text-red-600">
              {state.errors.password.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          )}
        </div>

        <label className="flex items-start gap-2 text-sm text-zinc-700 dark:text-zinc-300">
          <input
            type="checkbox"
            name="termsAccepted"
            required
            className="mt-1"
          />
          <span>
            I agree to the{" "}
            <Link href={`/${lang}/privacy`} className="underline">
              Terms of Service and Privacy Policy
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
          className="mt-2 rounded-full bg-foreground px-5 py-2 text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {pending ? "Creating account..." : "Sign Up"}
        </button>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Already have an account?{" "}
          <Link href={`/${lang}/login`} className="font-medium underline">
            Log in
          </Link>
        </p>
      </form>
    </div>
  );
}
