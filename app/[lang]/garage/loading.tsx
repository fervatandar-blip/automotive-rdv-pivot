import { Loader2 } from "lucide-react";

// Covers every page under the garage portal (dashboard, calendar, clients,
// availability, services, invoices, documents, etc.) automatically -- see
// app/[lang]/(client)/loading.tsx for the same pattern and its caveat about
// not covering the layout's own async work above it.
export default function GarageLoading() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-black">
      <Loader2
        className="h-6 w-6 animate-spin text-zinc-400 dark:text-zinc-600"
        strokeWidth={1.5}
      />
    </div>
  );
}
