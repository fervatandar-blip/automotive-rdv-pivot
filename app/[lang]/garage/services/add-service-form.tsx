"use client";

import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { createService } from "@/app/actions/services";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import { ServiceFields } from "./service-fields";

export function AddServiceForm({ d }: { d: Dictionary["garageServices"] }) {
  const [state, action, pending] = useActionState(createService, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  const wasPending = useRef(false);
  // Remounting the fields after a successful add also resets the pricing
  // type selector, which form.reset() alone can't (it's React state).
  const [resetKey, setResetKey] = useState(0);
  const { lang } = useParams<{ lang: string }>();

  useEffect(() => {
    if (wasPending.current && !pending && !state?.errors && !state?.message) {
      formRef.current?.reset();
      setResetKey((key) => key + 1);
    }
    wasPending.current = pending;
  }, [pending, state]);

  return (
    <form
      ref={formRef}
      action={action}
      className="flex flex-col gap-5 rounded-xl border border-zinc-200/80 bg-white p-5 sm:p-6 dark:border-zinc-800/60 dark:bg-zinc-900/40"
    >
      <input type="hidden" name="lang" value={lang} />
      <h2 className="text-base font-semibold text-black dark:text-zinc-50">{d.addTitle}</h2>

      <ServiceFields key={resetKey} d={d.fields} errors={state?.errors} />

      {state?.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}

      <button
        disabled={pending}
        type="submit"
        className="self-start rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-600"
      >
        {pending ? d.adding : d.add}
      </button>
    </form>
  );
}
