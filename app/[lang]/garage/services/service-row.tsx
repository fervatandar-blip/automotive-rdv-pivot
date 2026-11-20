"use client";

import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { deleteService, updateService } from "@/app/actions/services";
import { formatServicePrice } from "@/lib/service-pricing";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ServiceCategoryLabels } from "@/lib/service-categories";
import { ServiceFields } from "./service-fields";

export type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number;
  pricing_type: string;
  price: number | string | null;
};

const GHOST_BUTTON =
  "rounded-full px-3 py-1.5 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-black dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50";

export function ServiceRow({
  service,
  d,
  priceLabels,
  categoryLabels,
}: {
  service: Service;
  d: Dictionary["garageServices"];
  priceLabels: Dictionary["servicePrice"];
  categoryLabels: ServiceCategoryLabels;
}) {
  const [editing, setEditing] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [state, action, pending] = useActionState(updateService, undefined);
  const wasPending = useRef(false);
  const { lang } = useParams<{ lang: string }>();

  useEffect(() => {
    if (wasPending.current && !pending && !state?.errors && !state?.message) {
      setEditing(false);
    }
    wasPending.current = pending;
  }, [pending, state]);

  if (!editing) {
    return (
      <li className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h4 className="font-medium text-black dark:text-zinc-50">{service.name}</h4>
          {service.description && (
            <p className="mt-0.5 text-sm text-zinc-600 dark:text-zinc-400">{service.description}</p>
          )}
          <p className="mt-1.5 text-sm text-zinc-600 dark:text-zinc-400">
            {service.duration_minutes} min ·{" "}
            <span className="font-medium tabular-nums text-black dark:text-zinc-50">
              {formatServicePrice(service, priceLabels)}
            </span>
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {confirmingDelete ? (
            <>
              <button type="button" onClick={() => setConfirmingDelete(false)} className={GHOST_BUTTON}>
                {d.keep}
              </button>
              <form action={deleteService}>
                <input type="hidden" name="id" value={service.id} />
                <input type="hidden" name="lang" value={lang} />
                <button
                  type="submit"
                  className="rounded-full bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 dark:bg-red-500/90 dark:hover:bg-red-500"
                >
                  {d.confirmDelete}
                </button>
              </form>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className={GHOST_BUTTON}>
                {d.edit}
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="rounded-full px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                {d.delete}
              </button>
            </>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="py-4">
      <form action={action} className="flex flex-col gap-5">
        <input type="hidden" name="id" value={service.id} />
        <input type="hidden" name="lang" value={lang} />

        <ServiceFields
          d={d.fields}
          categoryLabels={categoryLabels}
          errors={state?.errors}
          defaults={{
            name: service.name,
            description: service.description,
            category: service.category,
            durationMinutes: service.duration_minutes,
            pricingType: service.pricing_type,
            price: service.price,
          }}
        />

        {state?.message && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
        )}

        <div className="flex gap-2">
          <button
            disabled={pending}
            type="submit"
            className="rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-60 dark:bg-brand-500 dark:hover:bg-brand-600"
          >
            {pending ? d.saving : d.save}
          </button>
          <button type="button" onClick={() => setEditing(false)} className={GHOST_BUTTON}>
            {d.cancel}
          </button>
        </div>
      </form>
    </li>
  );
}
