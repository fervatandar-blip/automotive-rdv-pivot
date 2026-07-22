"use client";

import { useParams } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { addVehicle } from "@/app/actions/vehicles";
import { StyledSelect } from "@/components/styled-select";

export function AddVehicleForm({
  brands,
}: {
  brands: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(addVehicle, undefined);
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
        Add a vehicle
      </h2>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="brandId" className="text-sm font-medium">
            Brand
          </label>
          <StyledSelect id="brandId" name="brandId" defaultValue="">
            <option value="">Not specified</option>
            {brands.map((brand) => (
              <option key={brand.id} value={brand.id}>
                {brand.name}
              </option>
            ))}
          </StyledSelect>
          {state?.errors?.brandId && (
            <p className="text-sm text-red-600">{state.errors.brandId[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="model" className="text-sm font-medium">
            Model
          </label>
          <input
            id="model"
            name="model"
            placeholder="Corolla"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.model && (
            <p className="text-sm text-red-600">{state.errors.model[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="year" className="text-sm font-medium">
            Year
          </label>
          <input
            id="year"
            name="year"
            type="number"
            placeholder="2020"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.year && (
            <p className="text-sm text-red-600">{state.errors.year[0]}</p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="licensePlate" className="text-sm font-medium">
            License plate
          </label>
          <input
            id="licensePlate"
            name="licensePlate"
            placeholder="LU 1234"
            className="rounded-md border border-black/[.08] px-3 py-2 dark:border-white/[.145] dark:bg-black"
          />
          {state?.errors?.licensePlate && (
            <p className="text-sm text-red-600">
              {state.errors.licensePlate[0]}
            </p>
          )}
        </div>
      </div>

      {state?.message && (
        <p className="text-sm text-red-600">{state.message}</p>
      )}

      <button
        disabled={pending}
        type="submit"
        className="self-start rounded-full bg-brand-600 px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50 dark:bg-brand-500 dark:hover:bg-brand-600"
      >
        {pending ? "Adding..." : "Add vehicle"}
      </button>
    </form>
  );
}
