"use client";

import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { createService } from "@/app/actions/services";

type AddServiceFormDictionary = {
  title: string;
  nameLabel: string;
  namePlaceholder: string;
  descriptionLabel: string;
  descriptionPlaceholder: string;
  durationLabel: string;
  durationPlaceholder: string;
  priceLabel: string;
  pricePlaceholder: string;
  submit: string;
  submitPending: string;
};

export function AddServiceForm({
  dictionary,
}: {
  dictionary: AddServiceFormDictionary;
}) {
  const [state, action, pending] = useActionState(createService, undefined);
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

      <div className="flex flex-col gap-1">
        <label htmlFor="name" className="text-sm font-medium">
          {dictionary.nameLabel}
        </label>
        <input
          id="name"
          name="name"
          placeholder={dictionary.namePlaceholder}
          className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
        {state?.errors?.name && (
          <p className="text-sm text-red-600">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="description" className="text-sm font-medium">
          {dictionary.descriptionLabel}
        </label>
        <textarea
          id="description"
          name="description"
          rows={2}
          placeholder={dictionary.descriptionPlaceholder}
          className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
        {state?.errors?.description && (
          <p className="text-sm text-red-600">
            {state.errors.description[0]}
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="durationMinutes" className="text-sm font-medium">
            {dictionary.durationLabel}
          </label>
          <input
            id="durationMinutes"
            name="durationMinutes"
            type="number"
            min="1"
            placeholder={dictionary.durationPlaceholder}
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.durationMinutes && (
            <p className="text-sm text-red-600">
              {state.errors.durationMinutes[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="price" className="text-sm font-medium">
            {dictionary.priceLabel}
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min="0"
            step="0.01"
            placeholder={dictionary.pricePlaceholder}
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.price && (
            <p className="text-sm text-red-600">{state.errors.price[0]}</p>
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
