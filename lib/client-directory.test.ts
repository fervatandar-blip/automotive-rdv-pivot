import { describe, expect, it } from "vitest";
import {
  FREQUENT_MIN_VISITS,
  clientMatches,
  directoryStats,
  parseDirectoryFilter,
  parseDirectorySort,
  visibleClients,
  type DirectoryClient,
} from "@/lib/client-directory";

function client(overrides: Partial<DirectoryClient> & { name: string }): DirectoryClient {
  return {
    id: `client:${overrides.name}`,
    kind: "client",
    subjectId: overrides.name,
    anonymized: false,
    email: null,
    phone: null,
    phoneDigits: "",
    isVip: false,
    hasNotes: false,
    activeThisMonth: false,
    appointmentCount: 0,
    visitCount: 0,
    lastVisit: null,
    nextVisit: null,
    vehicles: [],
    ...overrides,
  };
}

const ana = client({
  name: "Ana Costa",
  email: "ana@example.com",
  phone: "+352 621 12 34 56",
  phoneDigits: "352621123456",
  appointmentCount: 5,
  visitCount: 4,
  lastVisit: "2026-10-20T09:00:00Z",
  nextVisit: "2026-11-10T09:00:00Z",
  vehicles: [
    { id: "v1", label: "VW Golf", licensePlate: "LU-1234", plateSearch: "LU1234", vin: "WVWZZZ1KZ6W000001", visits: [] },
  ],
});
const ben = client({ name: "ben Weber", appointmentCount: 1, visitCount: 1, lastVisit: "2026-11-01T09:00:00Z" });
const chloe = client({ name: "Chloé Martin", kind: "walk_in", appointmentCount: 0 });

describe("clientMatches", () => {
  it("matches name and email, case-insensitively", () => {
    expect(clientMatches(ana, "COSTA")).toBe(true);
    expect(clientMatches(ana, "ana@ex")).toBe(true);
  });

  it("matches a phone by digits, however it's typed, from four digits up", () => {
    expect(clientMatches(ana, "621 123")).toBe(true);
    expect(clientMatches(ana, "+352621123456")).toBe(true);
    expect(clientMatches(ana, "621")).toBe(false);
  });

  it("matches plates and VINs however they're spaced", () => {
    expect(clientMatches(ana, "lu 1234")).toBe(true);
    expect(clientMatches(ana, "wvwzzz1kz6")).toBe(true);
    expect(clientMatches(ben, "lu 1234")).toBe(false);
  });

  it("matches everyone on an empty query", () => {
    expect(clientMatches(ben, "  ")).toBe(true);
  });
});

describe("visibleClients", () => {
  const all = [ben, chloe, ana];
  const names = (list: DirectoryClient[]) => list.map((entry) => entry.name);

  it("sorts by last visit, newest first, never-visited last", () => {
    expect(names(visibleClients(all, { query: "", filter: "all", sort: "last-visit", locale: "en" }))).toEqual([
      "ben Weber",
      "Ana Costa",
      "Chloé Martin",
    ]);
  });

  it("sorts alphabetically regardless of case and accents", () => {
    expect(names(visibleClients(all, { query: "", filter: "all", sort: "alphabetical", locale: "fr" }))).toEqual([
      "Ana Costa",
      "ben Weber",
      "Chloé Martin",
    ]);
  });

  it("sorts by number of appointments", () => {
    expect(names(visibleClients(all, { query: "", filter: "all", sort: "appointments", locale: "en" }))).toEqual([
      "Ana Costa",
      "ben Weber",
      "Chloé Martin",
    ]);
  });

  it("filters to clients with an upcoming booking", () => {
    expect(names(visibleClients(all, { query: "", filter: "upcoming", sort: "alphabetical", locale: "en" }))).toEqual([
      "Ana Costa",
    ]);
  });

  it(`filters to frequent clients (${FREQUENT_MIN_VISITS}+ visits)`, () => {
    expect(names(visibleClients(all, { query: "", filter: "frequent", sort: "alphabetical", locale: "en" }))).toEqual([
      "Ana Costa",
    ]);
  });

  it("combines search with filters", () => {
    expect(visibleClients(all, { query: "weber", filter: "upcoming", sort: "alphabetical", locale: "en" })).toEqual([]);
  });

  it("falls back to safe defaults for unknown URL values", () => {
    expect(parseDirectoryFilter("vip")).toBe("all");
    expect(parseDirectorySort("newest")).toBe("last-visit");
  });
});

describe("directoryStats", () => {
  it("counts live clients, those active this month and VIPs, never anonymized ones", () => {
    expect(
      directoryStats([
        client({ name: "A", isVip: true, activeThisMonth: true }),
        client({ name: "B", activeThisMonth: true }),
        client({ name: "C" }),
        client({ name: "Deleted customer", anonymized: true, isVip: true, activeThisMonth: true }),
      ])
    ).toEqual({ total: 3, activeThisMonth: 2, vip: 1 });
  });
});
