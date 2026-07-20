"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-4 py-16 dark:bg-black">
      <div className="flex w-full max-w-sm flex-col items-center gap-4 rounded-xl border border-black/[.08] bg-white p-8 text-center dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
          Something went wrong
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          An unexpected error occurred. You can try again, or head back to
          the homepage.
        </p>
        <div className="mt-2 flex gap-3">
          <button
            type="button"
            onClick={reset}
            className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Try again
          </button>
          <Link
            href="/"
            className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a]"
          >
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
