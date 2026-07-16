"use client";

import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { deleteService, updateService } from "@/app/actions/services";

export type Service = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  price: number;
};

export function ServiceRow({ service }: { service: Service }) {
  const [editing, setEditing] = useState(false);
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
      <div className="flex items-start justify-between gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <div>
          <h3 className="font-semibold text-black dark:text-zinc-50">
            {service.name}
          </h3>
          {service.description && (
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {service.description}
            </p>
          )}
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {service.duration_minutes} min &middot; $
            {Number(service.price).toFixed(2)}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            onClick={() => setEditing(true)}
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Edit
          </button>
          <form action={deleteService}>
            <input type="hidden" name="id" value={service.id} />
            <input type="hidden" name="lang" value={lang} />
            <button
              type="submit"
              className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
            >
              Delete
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="flex flex-col gap-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950"
    >
      <input type="hidden" name="id" value={service.id} />
      <input type="hidden" name="lang" value={lang} />

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Name</label>
        <input
          name="name"
          defaultValue={service.name}
          className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
        />
        {state?.errors?.name && (
          <p className="text-sm text-red-600">{state.errors.name[0]}</p>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-sm font-medium">Description</label>
        <textarea
          name="description"
          rows={2}
          defaultValue={service.description ?? ""}
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
          <label className="text-sm font-medium">Duration (minutes)</label>
          <input
            name="durationMinutes"
            type="number"
            min="1"
            defaultValue={service.duration_minutes}
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.durationMinutes && (
            <p className="text-sm text-red-600">
              {state.errors.durationMinutes[0]}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-sm font-medium">Price</label>
          <input
            name="price"
            type="number"
            min="0"
            step="0.01"
            defaultValue={service.price}
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

      <div className="flex gap-2">
        <button
          disabled={pending}
          type="submit"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {pending ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => setEditing(false)}
          className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
