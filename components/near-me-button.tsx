"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LocateFixed, Loader2 } from "lucide-react";

const DEFAULT_CLASS =
  "flex shrink-0 items-center gap-2 rounded-full border border-hairline bg-surface px-4 py-2.5 text-sm font-medium transition-colors hover:bg-subtle disabled:opacity-60";

export function NearMeButton({ label = "Near me", className = DEFAULT_CLASS }: { label?: string; className?: string }) {
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
      aria-busy={locating}
      className={className}
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
