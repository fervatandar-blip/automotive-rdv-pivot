import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import en from "@/lib/i18n/dictionaries/en.json";

vi.mock("next/navigation", () => ({ usePathname: () => "/en/garage/calendar" }));
vi.mock("@/app/actions/auth", () => ({ logout: async () => {} }));

const { GarageSidebar } = await import("./garage-nav");

function render(props: { isOwner: boolean; needsVerification: boolean }) {
  return renderToStaticMarkup(<GarageSidebar lang="en" labels={en.garageNav} {...props} />);
}

function position(html: string, text: string) {
  return html.indexOf(`>${text}<`);
}

describe("GarageSidebar", () => {
  it("shows the three groups in order with their items", () => {
    const html = render({ isOwner: true, needsVerification: false });
    const order = [
      "Operations",
      "Dashboard",
      "Calendar &amp; Agenda",
      "Client Directory",
      "Services",
      "Services &amp; Pricing",
      "Messages",
      "Settings",
      "Garage Profile",
      "Working Hours",
      "Staff",
    ].map((text) => position(html, text));
    expect(order.every((at, i) => at > -1 && (i === 0 || at > order[i - 1]))).toBe(true);
  });

  it("drops Reviews, Waitlist and (once approved) Verification from the menu", () => {
    const html = render({ isOwner: true, needsVerification: false });
    expect(html).not.toContain("/garage/reviews");
    expect(html).not.toContain("/garage/waitlist");
    expect(html).not.toContain("/garage/documents");
  });

  it("keeps Verification reachable for an owner whose garage isn't approved", () => {
    expect(render({ isOwner: true, needsVerification: true })).toContain("/en/garage/documents");
    // Mechanics can't open the owner-only documents or staff pages.
    const mechanic = render({ isOwner: false, needsVerification: true });
    expect(mechanic).not.toContain("/en/garage/documents");
    expect(mechanic).not.toContain("/en/garage/staff");
  });

  it("keeps Notifications and Account reachable from the footer", () => {
    const html = render({ isOwner: false, needsVerification: false });
    expect(html).toContain("/en/garage/notifications");
    expect(html).toContain("/en/account");
  });

  it("marks only the current page active, with the subtle highlight", () => {
    const html = render({ isOwner: true, needsVerification: false });
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/href="\/en\/garage\/calendar"[^>]*aria-current="page"|aria-current="page"[^>]*href="\/en\/garage\/calendar"/);
    expect(html).toContain("bg-zinc-800/60");
    expect(html).not.toContain("bg-brand-600");
  });
});
