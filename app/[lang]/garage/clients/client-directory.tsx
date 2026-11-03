"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useRef, useState } from "react";
import { CalendarPlus, Mail, NotebookPen, Phone, Search, Star, X } from "lucide-react";
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
  "inline-flex shrink-0 items-center rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 font-mono text-xs uppercase tracking-wide text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200";

// Five columns from md up; below that each row stacks.
const ROW_GRID =
  "md:grid md:grid-cols-[minmax(0,2.3fr)_minmax(0,0.9fr)_minmax(0,1.7fr)_minmax(0,1.3fr)_minmax(0,auto)] md:items-center md:gap-4";

const MAX_VEHICLES_SHOWN = 2;

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
 * The garage's client list as a table: client & contact, tags, vehicles,
 * activity, actions. Instant search (name, phone, plate, VIN), filter pills
 * and sort live in one toolbar on top and are mirrored into the URL
 * (replaceState) so opening a client's panel and closing it lands back on
 * the same list. One shared booking modal serves every row's "+ Book".
 *
 * Built as a CSS grid with table roles rather than <table>: the whole row
 * is a click target (a stretched link), which needs a positioned row, and
 * rows stack into cards on phones instead of scrolling sideways.
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
  const countText =
    query || filter !== "all"
      ? d.resultsCount.replace("{count}", String(results.length))
      : d.clientCount.replace("{count}", String(clients.length));

  return (
    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/30">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 border-b border-zinc-200 p-3 lg:flex-row lg:items-center dark:border-zinc-800">
        <div className="relative min-w-0 flex-1">
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
            className="w-full rounded-lg border border-zinc-200 bg-zinc-50 py-2 pl-9 pr-9 text-sm focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-600/20 dark:border-zinc-800 dark:bg-zinc-950/60 dark:focus:bg-zinc-950"
          />
          {query && (
            <button
              type="button"
              onClick={() => {
                setQuery("");
                syncUrl({ q: "" });
              }}
              aria-label={d.clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              <X className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label={d.filtersLabel}
            className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100/80 p-0.5 dark:border-zinc-800 dark:bg-zinc-950/60"
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
                className={`whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  filter === option
                    ? "bg-white text-black shadow-sm dark:bg-zinc-800 dark:text-zinc-50"
                    : "text-zinc-600 hover:text-black dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {filterLabels[option]}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
            <span className="sr-only sm:not-sr-only">{d.sortLabel}</span>
            <select
              value={sort}
              onChange={(event) => {
                const next = event.target.value as DirectorySort;
                setSort(next);
                syncUrl({ sort: next });
              }}
              aria-label={d.sortLabel}
              className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-sm text-black dark:border-zinc-800 dark:bg-zinc-950/60 dark:text-zinc-50"
            >
              {DIRECTORY_SORTS.map((option) => (
                <option key={option} value={option}>
                  {sortLabels[option]}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {results.length === 0 ? (
        <p className="px-6 py-14 text-center text-sm text-zinc-600 dark:text-zinc-400" aria-live="polite">
          {clients.length === 0 ? d.noClientsYet : d.noMatches}
        </p>
      ) : (
        <div role="table" aria-label={d.title} aria-rowcount={results.length + 1}>
          <div role="rowgroup" className="hidden md:block">
            <div
              role="row"
              className={`${ROW_GRID} border-b border-zinc-200 bg-zinc-50/80 px-4 py-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400`}
            >
              <span role="columnheader">{d.colClient}</span>
              <span role="columnheader">{d.colTags}</span>
              <span role="columnheader">{d.colVehicles}</span>
              <span role="columnheader">{d.colActivity}</span>
              <span role="columnheader" className="sr-only">
                {d.colActions}
              </span>
            </div>
          </div>

          <div role="rowgroup" className="divide-y divide-zinc-200 dark:divide-zinc-800/60">
            {results.map((client) => {
              const shownVehicles = client.vehicles.slice(0, MAX_VEHICLES_SHOWN);
              const hiddenVehicles = client.vehicles.length - shownVehicles.length;
              const selected = client.id === selectedId;
              return (
                <div
                  key={client.id}
                  role="row"
                  className={`group relative flex flex-col gap-3 px-4 py-3.5 transition md:py-3 ${ROW_GRID} ${
                    selected
                      ? "bg-brand-50/70 dark:bg-brand-500/[.07]"
                      : "hover:bg-zinc-50 dark:hover:bg-zinc-900/40"
                  }`}
                >
                  {/* 1. Client & contact */}
                  <div role="cell" className="flex min-w-0 items-center gap-3">
                    <span
                      aria-hidden
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-xs font-semibold text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {initials(client.name)}
                    </span>
                    <div className="min-w-0">
                      {/* Stretched link: the whole row opens the panel. */}
                      <Link
                        href={hrefFor(client)}
                        scroll={false}
                        className="block truncate text-sm font-semibold text-black after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-inset focus-visible:after:ring-brand-600/50 dark:text-zinc-50"
                      >
                        {client.name}
                      </Link>
                      {client.phone && (
                        <a
                          href={`tel:${client.phone.replace(/[^\d+]/g, "")}`}
                          className="relative z-10 mt-0.5 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-800 hover:text-brand-600 dark:text-zinc-200 dark:hover:text-brand-400"
                        >
                          <Phone aria-hidden className="h-3.5 w-3.5 text-zinc-400" />
                          {client.phone}
                        </a>
                      )}
                      {client.email && (
                        <p className="flex min-w-0 items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
                          <Mail aria-hidden className="h-3 w-3 shrink-0" />
                          <span className="truncate">{client.email}</span>
                        </p>
                      )}
                    </div>
                  </div>

                  {/* 2. Tags */}
                  <div role="cell" className="flex flex-wrap items-center gap-1.5 md:pl-0 pl-12">
                    {client.isVip && (
                      <span
                        title={d.vipLabel}
                        className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-800 dark:bg-amber-500/15 dark:text-amber-300"
                      >
                        <Star aria-hidden className="h-3 w-3 fill-current" />
                        {d.vip}
                      </span>
                    )}
                    {client.hasNotes && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                        <NotebookPen aria-hidden className="h-3 w-3" />
                        {d.notesBadge}
                      </span>
                    )}
                    {client.kind === "walk_in" && (
                      <span className="rounded-full border border-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                        {d.walkInBadge}
                      </span>
                    )}
                  </div>

                  {/* 3. Vehicles */}
                  <div role="cell" className="flex min-w-0 flex-col gap-1 pl-12 md:pl-0">
                    {shownVehicles.length === 0 ? (
                      <span className="text-xs text-zinc-400 dark:text-zinc-500">{d.noVehiclesShort}</span>
                    ) : (
                      shownVehicles.map((vehicle) => (
                        <div key={vehicle.id} className="flex min-w-0 items-center gap-2">
                          {vehicle.licensePlate && (
                            <span
                              className={`${PLATE_PILL} ${
                                vehicleMatches(vehicle, vehicleTerm) ? "ring-2 ring-brand-600/50" : ""
                              }`}
                            >
                              {vehicle.licensePlate}
                            </span>
                          )}
                          <span className="truncate text-xs text-zinc-600 dark:text-zinc-400">{vehicle.label}</span>
                        </div>
                      ))
                    )}
                    {hiddenVehicles > 0 && (
                      <span className="text-[11px] text-zinc-500 dark:text-zinc-400">
                        {d.moreVehicles.replace("{count}", String(hiddenVehicles))}
                      </span>
                    )}
                  </div>

                  {/* 4. Activity */}
                  <div
                    role="cell"
                    className="flex flex-wrap gap-x-3 gap-y-0.5 pl-12 text-xs text-zinc-500 md:flex-col md:pl-0 dark:text-zinc-400"
                  >
                    <span className="font-medium text-zinc-800 dark:text-zinc-200">
                      {d.visitsCount.replace("{count}", String(client.visitCount))}
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
                  </div>

                  {/* 5. Actions: always on phones; on desktop on hover or keyboard focus. */}
                  <div
                    role="cell"
                    className="relative z-10 flex gap-2 pl-12 transition-opacity md:justify-end md:pl-0 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100"
                  >
                    {!client.anonymized && (
                      <button
                        type="button"
                        onClick={() => book(client)}
                        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-700 dark:bg-brand-500 dark:hover:bg-brand-600"
                      >
                        <CalendarPlus aria-hidden className="h-3.5 w-3.5" />
                        {d.book}
                        <span className="sr-only"> {client.name}</span>
                      </button>
                    )}
                    <Link
                      href={hrefFor(client)}
                      scroll={false}
                      className="inline-flex items-center whitespace-nowrap rounded-full border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-100 hover:text-black dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-zinc-50"
                    >
                      {d.viewProfile}
                      <span className="sr-only"> {client.name}</span>
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <p
        className="border-t border-zinc-200 px-4 py-2.5 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400"
        aria-live="polite"
      >
        {countText}
      </p>

      <WalkInModal ref={modalRef} lang={lang} d={walkInD} />
    </div>
  );
}
