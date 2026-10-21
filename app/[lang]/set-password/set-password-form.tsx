"use client";

import { Suspense, useActionState } from "react";
import { useSearchParams } from "next/navigation";
import { setPassword } from "@/app/actions/auth";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";

function SetPasswordCopy({ d }: { d: Dictionary["setPassword"] }) {
  const searchParams = useSearchParams();
  const isRecovery = searchParams.get("context") === "recovery";

  return (
    <>
      <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
        {isRecovery ? d.recoveryTitle : d.setTitle}
      </h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {isRecovery ? d.recoveryDescription : d.inviteDescription}
      </p>
    </>
  );
}

export function SetPasswordForm({
  lang,
  dictionary,
}: {
  lang: Locale;
  dictionary: Dictionary;
}) {
  const [state, action, pending] = useActionState(setPassword, undefined);
  const d = dictionary.setPassword;

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <form
        action={action}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <input type="hidden" name="lang" value={lang} />

        <Suspense fallback={null}>
          <SetPasswordCopy d={d} />
        </Suspense>

        <div className="flex flex-col gap-1">
          <label htmlFor="password" className="text-sm font-medium">
            {d.passwordLabel}
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
            {d.confirmPasswordLabel}
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
          {pending ? d.submitPending : d.submit}
        </button>
      </form>
    </div>
  );
}
