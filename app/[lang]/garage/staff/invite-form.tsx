"use client";

import { useActionState, useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { inviteMechanic } from "@/app/actions/staff";

type InviteFormDictionary = {
  title: string;
  nameLabel: string;
  namePlaceholder: string;
  emailLabel: string;
  emailPlaceholder: string;
  submit: string;
  submitPending: string;
};

export function InviteMechanicForm({
  dictionary,
}: {
  dictionary: InviteFormDictionary;
}) {
  const [state, action, pending] = useActionState(inviteMechanic, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const { lang } = useParams<{ lang: string }>();

  useEffect(() => {
    if (!pending && !state?.errors && !state?.message) {
      formRef.current?.reset();
    }
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
    >
      <input type="hidden" name="lang" value={lang} />

      <h2 className="text-lg font-semibold text-black dark:text-zinc-50">
        {dictionary.title}
      </h2>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="fullName" className="text-sm font-medium">
            {dictionary.nameLabel}
          </label>
          <input
            id="fullName"
            name="fullName"
            placeholder={dictionary.namePlaceholder}
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.fullName && (
            <p className="text-sm text-red-600">{state.errors.fullName[0]}</p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="email" className="text-sm font-medium">
            {dictionary.emailLabel}
          </label>
          <input
            id="email"
            name="email"
            type="email"
            placeholder={dictionary.emailPlaceholder}
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.email && (
            <p className="text-sm text-red-600">{state.errors.email[0]}</p>
          )}
        </div>
      </div>

      {state?.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      <button
        disabled={pending}
        type="submit"
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {pending ? dictionary.submitPending : dictionary.submit}
      </button>
    </form>
  );
}
