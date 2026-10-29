"use client";

import { useDeferredValue, useMemo, useState } from "react";
import { Car, Search, X } from "lucide-react";
import { normalizeVehicleSearch } from "@/lib/vehicle-identifiers";
import type { Dictionary } from "@/lib/i18n/get-dictionary";

type D = Dictionary["garageClients"];

export type DirectoryVisit = {
  id: string;
  startTime: string; // pre-formatted on the server, in the garage's zone
  serviceName: string;
  status: string;
};

export type DirectoryVehicle = {
  id: string;
  label: string;
  licensePlate: string | null;
  plateSearch: string;
  vin: string | null;
  visits: DirectoryVisit[];
};

export type DirectoryClient = {
  id: string;
  name: string;
  email: string;
  appointmentCount: number;
  vehicles: DirectoryVehicle[];
};

const STATUS_STYLES: Record<string, string> = {
  confirmed: "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-400",
  completed: "bg-zinc-100 text-zinc-700 dark:bg-white/[.08] dark:text-zinc-300",
  cancelled: "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400",
  pending: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
  pending_payment: "bg-amber-50 text-amber-800 dark:bg-amber-950 dark:text-amber-400",
};

function vehicleMatches(vehicle: DirectoryVehicle, term: string) {
  return (
    term.length > 0 &&
    (vehicle.plateSearch.includes(term) || (vehicle.vin?.includes(term) ?? false))
  );
}

export function ClientDirectory({
  clients,
  d,
  initialQuery,
}: {
  clients: DirectoryClient[];
  d: D;
  initialQuery: string;
}) {
  const [query, setQuery] = useState(initialQuery);
  const deferredQuery = useDeferredValue(query);

  const { results, vehicleTerm } = useMemo(() => {
    const text = deferredQuery.trim().toLowerCase();
    const term = normalizeVehicleSearch(deferredQuery);
    if (!text) return { results: clients, vehicleTerm: "" };

    return {
      vehicleTerm: term,
      results: clients.filter(
        (client) =>
          client.name.toLowerCase().includes(text) ||
          client.email.toLowerCase().includes(text) ||
          client.vehicles.some((vehicle) => vehicleMatches(vehicle, term))
      ),
    };
  }, [clients, deferredQuery]);

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400"
          strokeWidth={1.75}
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={d.searchPlaceholder}
          aria-label={d.searchLabel}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-black/[.08] bg-white py-3 pl-10 pr-10 text-sm shadow-sm dark:border-white/[.145] dark:bg-zinc-950"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label={d.clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {query
          ? d.resultsCount.replace("{count}", String(results.length))
          : d.clientCount.replace("{count}", String(clients.length))}
      </p>

      {results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-black/[.12] bg-white p-6 text-center text-sm text-zinc-600 dark:border-white/[.2] dark:bg-zinc-950 dark:text-zinc-400">
          {clients.length === 0 ? d.noClientsYet : d.noMatches}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {results.map((client) => {
            // When searching by plate/VIN, put the matching car first and
            // expand only its history; otherwise show everything collapsed.
            const vehicles = vehicleTerm
              ? [...client.vehicles].sort(
                  (a, b) => Number(vehicleMatches(b, vehicleTerm)) - Number(vehicleMatches(a, vehicleTerm))
                )
              : client.vehicles;

            return (
              <li
                key={client.id}
                className="flex flex-col gap-3 rounded-xl border border-black/[.08] bg-white p-4 dark:border-white/[.145] dark:bg-zinc-950"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-black dark:text-zinc-50">{client.name}</p>
                    <p className="truncate text-sm text-zinc-600 dark:text-zinc-400">{client.email}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-black/[.04] px-2.5 py-1 text-xs font-medium text-zinc-700 dark:bg-white/[.06] dark:text-zinc-300">
                    {client.appointmentCount}{" "}
                    {client.appointmentCount === 1 ? d.appointment : d.appointments}
                  </span>
                </div>

                {vehicles.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {vehicles.map((vehicle) => {
                      const isMatch = vehicleMatches(vehicle, vehicleTerm);
                      return (
                        <li
                          key={vehicle.id}
                          className={`rounded-lg border px-3 py-2 ${
                            isMatch
                              ? "border-brand-600/40 bg-brand-600/[.04] dark:border-brand-500/40 dark:bg-brand-500/[.06]"
                              : "border-black/[.06] dark:border-white/[.1]"
                          }`}
                        >
                          <details open={isMatch}>
                            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                              <Car className="h-4 w-4 shrink-0 text-zinc-500" strokeWidth={1.75} />
                              <span className="font-medium text-black dark:text-zinc-50">{vehicle.label}</span>
                              {vehicle.licensePlate && (
                                <span className="rounded border border-black/[.12] px-1.5 py-0.5 font-mono text-xs uppercase tracking-wide dark:border-white/[.2]">
                                  {vehicle.licensePlate}
                                </span>
                              )}
                              {vehicle.vin && (
                                <span className="font-mono text-xs text-zinc-500 dark:text-zinc-400">VIN {vehicle.vin}</span>
                              )}
                              <span className="ml-auto text-xs text-zinc-500 dark:text-zinc-400">
                                {d.visitCount.replace("{count}", String(vehicle.visits.length))}
                              </span>
                            </summary>
                            <ol className="mt-2 flex flex-col gap-1 border-t border-black/[.06] pt-2 dark:border-white/[.1]">
                              {vehicle.visits.map((visit) => (
                                <li key={visit.id} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                                  <span className="text-zinc-600 dark:text-zinc-400">
                                    {visit.startTime} · {visit.serviceName}
                                  </span>
                                  <span
                                    className={`rounded-full px-2 py-0.5 font-medium ${STATUS_STYLES[visit.status] ?? STATUS_STYLES.completed}`}
                                  >
                                    {d.statuses[visit.status as keyof typeof d.statuses] ?? visit.status}
                                  </span>
                                </li>
                              ))}
                            </ol>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
