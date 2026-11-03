import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import en from "@/lib/i18n/dictionaries/en.json";
import type { DirectoryClient } from "@/lib/client-directory";
import { ClientDirectory } from "./client-directory";

function client(overrides: Partial<DirectoryClient> & { name: string }): DirectoryClient {
  return {
    id: `walk_in:${overrides.name}`,
    kind: "walk_in",
    subjectId: "11111111-1111-4111-8111-111111111111",
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

function render(clients: DirectoryClient[], query = "") {
  return renderToStaticMarkup(
    <ClientDirectory
      clients={clients}
      d={en.garageClients}
      walkInD={en.walkIn}
      lang="en"
      dateLocale="en-GB"
      initialQuery={query}
      initialFilter="all"
      initialSort="last-visit"
      selectedId={null}
    />
  );
}

const vehicle = (id: string, plate: string, label: string) => ({
  id,
  label,
  licensePlate: plate,
  plateSearch: plate.replace(/[^A-Z0-9]/gi, "").toUpperCase(),
  vin: null,
  visits: [],
});

describe("ClientDirectory table", () => {
  const ana = client({
    name: "Ana Costa",
    email: "ana@example.com",
    phone: "+352 621 12 34 56",
    phoneDigits: "352621123456",
    isVip: true,
    hasNotes: true,
    visitCount: 4,
    lastVisit: "2026-10-20T09:00:00Z",
    nextVisit: "2026-11-10T09:00:00Z",
    vehicles: [
      vehicle("v1", "LU-1234", "Volkswagen Golf"),
      vehicle("v2", "AB-987", "Renault Clio"),
      vehicle("v3", "CD-555", "Peugeot 208"),
    ],
  });

  it("renders a table with five column headers and one row per client", () => {
    const html = render([ana, client({ name: "Ben Weber" })]);
    expect(html).toContain('role="table"');
    expect(html.match(/role="columnheader"/g)).toHaveLength(5);
    // Header row + 2 client rows.
    expect(html.match(/role="row"/g)).toHaveLength(3);
  });

  it("shows contact, tags, vehicles and activity in their columns", () => {
    const html = render([ana]);
    expect(html).toContain('href="tel:+352621123456"');
    expect(html).toContain("ana@example.com");
    expect(html).toContain(">VIP<");
    expect(html).toContain(">Notes<");
    expect(html).toContain(">LU-1234<");
    expect(html).toContain("Volkswagen Golf");
    // Two vehicles shown, the third summarised.
    expect(html).not.toContain(">CD-555<");
    expect(html).toContain("+1 more");
    expect(html).toContain("4 visit(s)");
    expect(html).toContain("Last visit 20 Oct 2026");
    expect(html).toContain("Next 10 Nov 2026");
  });

  it("hides actions until hover or keyboard focus on desktop, never on phones", () => {
    const html = render([ana]);
    expect(html).toContain("md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100");
    expect(html).toContain("Book<span class=\"sr-only\"> Ana Costa</span>");
  });

  it("offers no booking for an anonymized customer", () => {
    const html = render([client({ name: "Deleted customer", anonymized: true })]);
    expect(html).not.toContain(">Book<");
    expect(html).toContain("View profile");
  });

  it("highlights the plate matching the search", () => {
    const html = render([ana], "lu 1234");
    expect(html).toMatch(/ring-2 ring-brand-600\/50">LU-1234</);
  });
});
