"use client";

import { useState } from "react";
import Image from "next/image";

export function BrandLogoBadge({
  htmlFor,
  slug,
  name,
  selected,
}: {
  htmlFor: string;
  slug: string;
  name: string;
  selected: boolean;
}) {
  const [errored, setErrored] = useState(false);

  return (
    <label
      htmlFor={htmlFor}
      className={
        selected
          ? "flex w-24 cursor-pointer flex-col items-center gap-2 rounded-xl border border-brand-600 bg-brand-50 p-3 text-center dark:border-brand-500 dark:bg-brand-950"
          : "flex w-24 cursor-pointer flex-col items-center gap-2 rounded-xl border border-black/[.08] bg-white p-3 text-center transition-colors hover:bg-black/[.02] dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-white/[.03]"
      }
    >
      {!errored ? (
        <Image
          src={`/brands/${slug}.svg`}
          alt=""
          width={36}
          height={36}
          className="h-9 w-9 object-contain"
          onError={() => setErrored(true)}
        />
      ) : (
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black/[.04] text-xs font-semibold text-zinc-600 dark:bg-white/[.06] dark:text-zinc-300">
          {name.slice(0, 2).toUpperCase()}
        </div>
      )}
      <span
        className={
          selected
            ? "text-xs font-medium text-brand-700 dark:text-brand-400"
            : "text-xs font-medium text-zinc-700 dark:text-zinc-300"
        }
      >
        {name}
      </span>
    </label>
  );
}
