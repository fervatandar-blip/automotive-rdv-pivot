import { Loader2 } from "lucide-react";

// Covers every page under this route group (dashboard, garages,
// garages/[id], vehicles, account) automatically -- Next.js wraps each
// page's content in a Suspense boundary using this as the fallback, so one
// file here replaces what would otherwise need repeating per page. Doesn't
// cover ClientLayout's own auth check above it (layouts resolve before the
// Suspense boundary they contain), only the page content within.
export default function ClientLoading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <Loader2
        className="h-6 w-6 animate-spin text-zinc-400 dark:text-zinc-600"
        strokeWidth={1.5}
      />
    </div>
  );
}
