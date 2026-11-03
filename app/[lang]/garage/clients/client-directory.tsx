"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { CalendarPlus, Mail, Phone, Search, Star, X } from "lucide-react";
import {
  DIRECTORY_FILTERS,
  DIRECTORY_SORTS,
  vehicleMatches,
  visibleClients,
  type DirectoryClient,
  type DirectoryFilter,
  type DirectorySort,
} from "@/lib/client-directory";
import { normalizeVehicleSearch } from "@/lib/vehicle-identifiers";
import { WalkInModal, type WalkInModalHandle } from "@/components/quick-walk-in-modal";
import type { Dictionary } from "@/lib/i18n/get-dictionary";
import type { Locale } from "@/lib/i18n/config";
import { APP_TIME_ZONE } from "@/lib/timezone";

type D = Dictionary["garageClients"];

// Plates as physical-plate-ish pills; light and dark variants of the same look.
const PLATE_PILL =
  "inline-flex items-center rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  );
}

/**
 * The garage's client list: instant search (name, phone, plate, VIN),
 * filter pills, sort, and per-row actions. Search/filter/sort are mirrored
 * into the URL (replaceState) so opening a client's panel and closing it
 * again lands back on the same list. One shared booking modal serves every
 * row's "+ New booking".
 */
export function ClientDirectory({
  clients,
  d,
  walkInD,
  lang,
  dateLocale,
  initialQuery,
  initialFilter,
  initialSort,
  selectedId,
}: {
  clients: DirectoryClient[];
  d: D;
  walkInD: Dictionary["walkIn"];
  lang: Locale;
  dateLocale: string;
  initialQuery: string;
  initialFilter: DirectoryFilter;
  initialSort: DirectorySort;
  selectedId: string | null;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [filter, setFilter] = useState(initialFilter);
  const [sort, setSort] = useState(initialSort);
  const deferredQuery = useDeferredValue(query);
  const modalRef = useRef<WalkInModalHandle>(null);

  const results = useMemo(
    () => visibleClients(clients, { query: deferredQuery, filter, sort, locale: lang }),
    [clients, deferredQuery, filter, sort, lang]
  );
  const vehicleTerm = normalizeVehicleSearch(deferredQuery);

  const dayFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(dateLocale, {
        timeZone: APP_TIME_ZONE,
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [dateLocale]
  );

  function syncUrl(next: { q?: string; filter?: DirectoryFilter; sort?: DirectorySort }) {
    const url = new URL(window.location.href);
    const values = { q: query, filter, sort, ...next };
    if (values.q) url.searchParams.set("q", values.q);
    else url.searchParams.delete("q");
    if (values.filter !== "all") url.searchParams.set("filter", values.filter);
    else url.searchParams.delete("filter");
    if (values.sort !== "last-visit") url.searchParams.set("sort", values.sort);
    else url.searchParams.delete("sort");
    window.history.replaceState(null, "", url);
  }

  function hrefFor(client: DirectoryClient) {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (filter !== "all") params.set("filter", filter);
    if (sort !== "last-visit") params.set("sort", sort);
    params.set("client", client.id);
    return `/${lang}/garage/clients?${params}`;
  }

  function book(client: DirectoryClient) {
    modalRef.current?.open({
      customer: { kind: client.kind === "walk_in" ? "garage_customer" : "client", id: client.subjectId },
    });
  }

  const filterLabels: Record<DirectoryFilter, string> = {
    all: d.filterAll,
    upcoming: d.filterUpcoming,
    frequent: d.filterFrequent,
  };
  const sortLabels: Record<DirectorySort, string> = {
    "last-visit": d.sortLastVisit,
    alphabetical: d.sortAlphabetical,
    appointments: d.sortAppointments,
  };

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
          onChange={(event) => {
            setQuery(event.target.value);
            syncUrl({ q: event.target.value });
          }}
          placeholder={d.searchPlaceholder}
          aria-label={d.searchLabel}
          autoComplete="off"
          spellCheck={false}
          className="w-full rounded-xl border border-zinc-200 bg-white py-3 pl-10 pr-10 text-sm shadow-sm focus:border-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-zinc-800 dark:bg-zinc-900"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              syncUrl({ q: "" });
            }}
            aria-label={d.clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="group"
          aria-label={d.filtersLabel}
          className="inline-flex rounded-full border border-zinc-200 bg-zinc-100/80 p-1 dark:border-zinc-800 dark:bg-zinc-900/60"
        >
          {DIRECTORY_FILTERS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={filter === option}
              onClick={() => {
                setFilter(option);
                syncUrl({ filter: option });
              }}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === option
                  ? "bg-white text-black shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:text-zinc-50 dark:ring-zinc-700/60"
                  : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {filterLabels[option]}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {d.sortLabel}
          <select
            value={sort}
            onChange={(event) => {
              const next = event.target.value as DirectorySort;
              setSort(next);
              syncUrl({ sort: next });
            }}
            className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-black dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-50"
          >
            {DIRECTORY_SORTS.map((option) => (
              <option key={option} value={option}>
                {sortLabels[option]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400" aria-live="polite">
        {query || filter !== "all"
          ? d.resultsCount.replace("{count}", String(results.length))
          : d.clientCount.replace("{count}", String(clients.length))}
      </p>

      {results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-zinc-300 bg-white p-8 text-center text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          {clients.length === 0 ? d.noClientsYet : d.noMatches}
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {results.map((client) => {
            const plates = client.vehicles.filter((vehicle) => vehicle.licensePlate);
            return (
              <li
                key={client.id}
                className={`relative flex flex-col gap-3 rounded-xl border bg-white p-4 transition-colors sm:flex-row sm:items-start sm:gap-4 dark:bg-zinc-900 ${
                  client.id === selectedId
                    ? "border-brand-600/60 ring-1 ring-brand-600/30 dark:border-brand-500/60"
                    : "border-zinc-200 hover:border-zinc-300 hover:bg-zinc-50/60 dark:border-zinc-800 dark:hover:border-zinc-700 dark:hover:bg-zinc-900/80"
                }`}
              >
                <span
                  aria-hidden
                  className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-sm font-semibold text-zinc-700 sm:flex dark:bg-zinc-800 dark:text-zinc-200"
                >
                  {initials(client.name)}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {/* Stretched link: the whole card opens the panel. */}
                    <Link
                      href={hrefFor(client)}
                      scroll={false}
                      className="truncate font-semibold text-black after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-brand-600/50 dark:text-zinc-50"
                    >
                      {client.name}
                    </Link>
                    {client.isVip && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">
                        <Star aria-hidden className="h-3 w-3 fill-current" />
                        {d.vip}
                      </span>
                    )}
                    {client.kind === "walk_in" && (
                      <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {d.walkInBadge}
                      </span>
                    )}
                  </div>

                  {(client.phone || client.email) && (
                    <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      {client.phone && (
                        <a
                          href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}
                          className="relative z-10 inline-flex items-center gap-1.5 font-medium text-black hover:text-brand-600 dark:text-zinc-100 dark:hover:text-brand-400"
                        >
                          <Phone aria-hidden className="h-3.5 w-3.5 text-zinc-400" />
                          {client.phone}
                        </a>
                      )}
                      {client.email && (
                        <span className="inline-flex min-w-0 items-center gap-1.5 text-zinc-600 dark:text-zinc-400">
                          <Mail aria-hidden className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                          <span className="truncate">{client.email}</span>
                        </span>
                      )}
                    </div>
                  )}

                  {plates.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {plates.map((vehicle) => (
                        <span
                          key={vehicle.id}
                          title={vehicle.label}
                          className={`${PLATE_PILL} ${
                            vehicleMatches(vehicle, vehicleTerm) ? "ring-2 ring-brand-600/50" : ""
                          }`}
                        >
                          {vehicle.licensePlate}
                        </span>
                      ))}
                    </div>
                  )}

                  <p className="mt-2 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    <span>
                      {client.appointmentCount}{" "}
                      {client.appointmentCount === 1 ? d.appointment : d.appointments}
                    </span>
                    <span>
                      {client.lastVisit
                        ? d.lastVisit.replace("{date}", dayFormatter.format(new Date(client.lastVisit)))
                        : d.noVisitsYet}
                    </span>
                    {client.nextVisit && (
                      <span className="font-medium text-green-700 dark:text-green-400">
                        {d.nextVisit.replace("{date}", dayFormatter.format(new Date(client.nextVisit)))}
                      </span>
                    )}
                  </p>
                </div>

                <div className="relative z-10 flex shrink-0 gap-2">
                  {!client.anonymized && (
                    <button
                      type="button"
                      onClick={() => book(client)}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                    >
                      <CalendarPlus aria-hidden className="h-3.5 w-3.5" />
                      {d.newBooking}
                    </button>
                  )}
                  <Link
                    href={hrefFor(client)}
                    scroll={false}
                    className="inline-flex items-center rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                  >
                    {d.details}
                  </Link>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <WalkInModal ref={modalRef} lang={lang} d={walkInD} />
    </div>
  );
}
