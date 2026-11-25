"use client";

import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { createService } from "@/app/actions/services";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ServiceCategoryLabels } from "@/lib/service-categories";
import { ServiceFields } from "./service-fields";

export function AddServiceForm({
  d,
  categoryLabels,
}: {
  d: Dictionary["garageServices"];
  categoryLabels: ServiceCategoryLabels;
}) {
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
      className="flex flex-col gap-5 rounded-2xl border border-zinc-200/70 bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:border-hairline dark:shadow-none p-5 sm:p-6"
    >
      <input type="hidden" name="lang" value={lang} />
      <h2 className="text-base font-semibold text-ink">{d.addTitle}</h2>

      <ServiceFields key={resetKey} d={d.fields} categoryLabels={categoryLabels} errors={state?.errors} />

      {state?.message && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}

      <button
        disabled={pending}
        type="submit"
        className="self-start rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-ink/85 disabled:opacity-60"
      >
        {pending ? d.adding : d.add}
      </button>
    </form>
  );
}
