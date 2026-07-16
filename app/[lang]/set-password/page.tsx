"use client";

import { useActionState } from "react";
import { useParams } from "next/navigation";
import { setPassword } from "@/app/actions/auth";

export default function SetPasswordPage() {
  const [state, action, pending] = useActionState(setPassword, undefined);
  const { lang } = useParams<{ lang: string }>();

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <form
        action={action}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <input type="hidden" name="lang" value={lang} />

        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Set your password
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You&apos;ve accepted an invite. Choose a password to finish setting
          up your account.
        </p>

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

        <div className="flex flex-col gap-1">
          <label htmlFor="confirmPassword" className="text-sm font-medium">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.confirmPassword && (
            <p className="text-sm text-red-600">
              {state.errors.confirmPassword[0]}
            </p>
          )}
        </div>

        {state?.message && (
          <p className="text-sm text-red-600">{state.message}</p>
        )}

        <button
          disabled={pending}
          type="submit"
          className="mt-2 rounded-full bg-foreground px-5 py-2 text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {pending ? "Saving..." : "Set password & continue"}
        </button>
      </form>
    </div>
  );
}
