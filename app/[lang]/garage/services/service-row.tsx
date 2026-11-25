"use client";

import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { deleteService, updateService } from "@/app/actions/services";
import { Clock } from "lucide-react";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { ServiceCategoryLabels } from "@/lib/service-categories";
import { ServiceFields } from "./service-fields";

export type Service = {
  id: string;
  name: string;
  description: string | null;
  category: string;
  duration_minutes: number;
};

const GHOST_BUTTON =
  "rounded-xl px-3.5 py-2 text-sm font-semibold text-ink transition-colors hover:bg-subtle hover:text-ink";

export function ServiceRow({
  service,
  d,
  categoryLabels,
}: {
  service: Service;
  d: Dictionary["garageServices"];
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
          <h4 className="font-semibold text-ink">{service.name}</h4>
          {service.description && (
            <p className="mt-0.5 text-sm text-ink-muted">{service.description}</p>
          )}
          <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-subtle px-2.5 py-1 text-xs font-semibold tabular-nums text-ink-muted">
            <Clock aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            {service.duration_minutes} min
          </span>
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
            className="rounded-xl bg-ink px-5 py-2.5 text-sm font-semibold text-surface transition-colors hover:bg-ink/85 disabled:opacity-60"
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
