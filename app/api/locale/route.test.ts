import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const updates: unknown[] = [];
let user: { id: string } | null = { id: "user-1" };

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user } }) },
    from: () => ({
      update: (values: unknown) => ({
        eq: async () => {
          updates.push(values);
          return { error: null };
        },
      }),
    }),
  }),
}));

const { POST } = await import("./route");

function request(body: unknown, origin: string | null = "https://rdv.example") {
  return new NextRequest("https://rdv.example/api/locale", {
    method: "POST",
    headers: { "content-type": "application/json", ...(origin ? { origin } : {}) },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  updates.length = 0;
  user = { id: "user-1" };
});

describe("POST /api/locale", () => {
  it("saves a signed-in user's language and remembers it in cookies", async () => {
    const response = await POST(request({ locale: "en" }));

    expect(response.status).toBe(204);
    expect(updates).toEqual([{ preferred_locale: "en" }]);
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("en");
    expect(response.cookies.get("rdv_locale_synced")?.value).toBe("user-1:en");
  });

  it("only sets the cookie for a signed-out visitor", async () => {
    user = null;
    const response = await POST(request({ locale: "fr" }));
    expect(response.status).toBe(204);
    expect(updates).toHaveLength(0);
    expect(response.cookies.get("NEXT_LOCALE")?.value).toBe("fr");
  });

  it("refuses cross-site calls and unknown languages", async () => {
    expect((await POST(request({ locale: "en" }, "https://evil.example"))).status).toBe(403);
    expect((await POST(request({ locale: "en" }, null))).status).toBe(403);
    expect((await POST(request({ locale: "de" }))).status).toBe(400);
    expect(updates).toHaveLength(0);
  });
});
