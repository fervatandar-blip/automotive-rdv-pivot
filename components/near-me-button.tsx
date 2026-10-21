"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LocateFixed, Loader2 } from "lucide-react";

export function NearMeButton({ label = "Near me" }: { label?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [locating, setLocating] = useState(false);

  function handleClick() {
    if (!("geolocation" in navigator)) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const params = new URLSearchParams(searchParams.toString());
        params.set("lat", String(position.coords.latitude));
        params.set("lng", String(position.coords.longitude));
        router.push(`?${params.toString()}`);
        setLocating(false);
      },
      () => {
        // Permission denied or unavailable -- silently skip, no distances shown.
        setLocating(false);
      }
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={locating}
      className="flex shrink-0 items-center gap-2 rounded-full border border-black/[.08] bg-white px-4 py-2.5 text-sm font-medium transition-colors hover:bg-black/[.04] disabled:opacity-60 dark:border-white/[.145] dark:bg-zinc-950 dark:hover:bg-white/[.06]"
    >
      {locating ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" strokeWidth={1.5} />
      ) : (
        <LocateFixed className="h-4 w-4 shrink-0" strokeWidth={1.5} />
      )}
      {label}
    </button>
  );
}
