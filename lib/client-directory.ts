import { normalizeVehicleSearch } from "@/lib/vehicle-identifiers";

/**
 * The garage client directory's data model and its pure search / filter /
 * sort logic (shared by the server page, which builds the rows, and the
 * client component, which filters them instantly as the user types).
 */

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
  // "client:<profile id>" or "walk_in:<garage customer id>": the two live in
  // different tables, so the kind is part of the key.
  id: string;
  kind: "client" | "walk_in";
  // The profile id (client) or garage_customers id (walk_in).
  subjectId: string;
  anonymized: boolean;
  name: string;
  email: string | null;
  phone: string | null;
  // Digits of the phone, for search.
  phoneDigits: string;
  isVip: boolean;
  // Every appointment here except unfinished checkouts.
  appointmentCount: number;
  // Non-cancelled appointments that have already started.
  visitCount: number;
  // ISO instants: the latest started visit, the next open booking.
  lastVisit: string | null;
  nextVisit: string | null;
  vehicles: DirectoryVehicle[];
};

export const DIRECTORY_FILTERS = ["all", "upcoming", "frequent"] as const;
export type DirectoryFilter = (typeof DIRECTORY_FILTERS)[number];

export const DIRECTORY_SORTS = ["last-visit", "alphabetical", "appointments"] as const;
export type DirectorySort = (typeof DIRECTORY_SORTS)[number];

/** "Frequent client": this many visits or more. */
export const FREQUENT_MIN_VISITS = 3;

export function parseDirectoryFilter(value: unknown): DirectoryFilter {
  return DIRECTORY_FILTERS.find((filter) => filter === value) ?? "all";
}

export function parseDirectorySort(value: unknown): DirectorySort {
  return DIRECTORY_SORTS.find((sort) => sort === value) ?? "last-visit";
}

export function vehicleMatches(vehicle: DirectoryVehicle, term: string) {
  return (
    term.length > 0 &&
    (vehicle.plateSearch.includes(term) || (vehicle.vin?.includes(term) ?? false))
  );
}

/**
 * Name / email anywhere in the text; phone by digits once there are at
 * least four (people type "+352 621 12 34 56" or "621123456"); plate and
 * VIN normalized ("lu-12 34" finds "LU1234").
 */
export function clientMatches(client: DirectoryClient, query: string) {
  const text = query.trim().toLowerCase();
  if (!text) return true;
  const term = normalizeVehicleSearch(query);
  const digits = query.replace(/\D/g, "");
  return (
    client.name.toLowerCase().includes(text) ||
    (client.email?.toLowerCase().includes(text) ?? false) ||
    (digits.length >= 4 && client.phoneDigits.includes(digits)) ||
    client.vehicles.some((vehicle) => vehicleMatches(vehicle, term))
  );
}

export function applyDirectoryFilter(clients: DirectoryClient[], filter: DirectoryFilter) {
  if (filter === "upcoming") return clients.filter((client) => client.nextVisit !== null);
  if (filter === "frequent") return clients.filter((client) => client.visitCount >= FREQUENT_MIN_VISITS);
  return clients;
}

export function sortDirectory(clients: DirectoryClient[], sort: DirectorySort, locale: string) {
  const byName = (a: DirectoryClient, b: DirectoryClient) =>
    a.name.localeCompare(b.name, locale, { sensitivity: "base" });
  const sorted = [...clients];
  if (sort === "alphabetical") return sorted.sort(byName);
  if (sort === "appointments") {
    return sorted.sort((a, b) => b.appointmentCount - a.appointmentCount || byName(a, b));
  }
  // Most recent visit first; people who've never come in (e.g. just added)
  // go last, alphabetically.
  return sorted.sort((a, b) => {
    if (a.lastVisit && b.lastVisit) return b.lastVisit.localeCompare(a.lastVisit) || byName(a, b);
    if (a.lastVisit) return -1;
    if (b.lastVisit) return 1;
    return byName(a, b);
  });
}

/** The visible list: search, then filter, then sort. */
export function visibleClients(
  clients: DirectoryClient[],
  { query, filter, sort, locale }: { query: string; filter: DirectoryFilter; sort: DirectorySort; locale: string }
) {
  return sortDirectory(
    applyDirectoryFilter(clients.filter((client) => clientMatches(client, query)), filter),
    sort,
    locale
  );
}
