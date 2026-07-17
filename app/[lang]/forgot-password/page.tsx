"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";

export default function ForgotPasswordPage() {
  const [state, action, pending] = useActionState(
    requestPasswordReset,
    undefined
  );
  const { lang } = useParams<{ lang: string }>();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <form
        action={action}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <input type="hidden" name="lang" value={lang} />

        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Reset your password
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Enter your account email and we&apos;ll send you a link to choose a
          new password.
        </p>

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

        {state?.message && (
          <p className="text-sm text-green-700 dark:text-green-500">
            {state.message}
          </p>
        )}

        <button
          disabled={pending}
          type="submit"
          className="mt-2 rounded-full bg-foreground px-5 py-2 text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {pending ? "Sending..." : "Send reset link"}
        </button>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href={`/${lang}/login`} className="font-medium underline">
            Back to log in
          </Link>
        </p>
      </form>
    </div>
  );
}
