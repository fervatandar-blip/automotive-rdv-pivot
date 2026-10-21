import { beforeEach, describe, expect, it, vi } from "vitest";

// Same reasoning as app/actions/auth.test.ts: requireGarageOwner calls
// requireGarageMember internally, which itself may redirect -- a
// non-throwing mock would let execution continue past that inner redirect
// with a null membership object and crash on `.isOwner` with an unrelated
// TypeError, masking the real behavior instead of reproducing it. This
// mock throws, matching Next's real redirect().
class RedirectSignal extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}
const redirectMock = vi.fn((url: string) => {
  throw new RedirectSignal(url);
});
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

let profileResult: { data: { id: string; role: string; deleted_at: string | null } | null } = {
  data: null,
};
let ownedGarageResult: { data: Record<string, unknown> | null } = { data: null };
let staffRowResult: { data: { garages: Record<string, unknown> } | null } = {
  data: null,
};

const fakeSupabase = {
  auth: {
    getUser: vi.fn(() =>
      Promise.resolve({ data: { user: { id: "user-1" } } })
    ),
  },
  from: vi.fn((table: string) => {
    if (table === "profiles") {
      return {
        select: () => ({
          eq: () => ({
            single: () => Promise.resolve(profileResult),
          }),
        }),
      };
    }
    if (table === "garages") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(ownedGarageResult),
          }),
        }),
      };
    }
    if (table === "garage_staff") {
      return {
        select: () => ({
          eq: () => ({
            maybeSingle: () => Promise.resolve(staffRowResult),
          }),
        }),
      };
    }
    throw new Error(`Unexpected table in test: ${table}`);
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(fakeSupabase),
}));

const {
  getGarageMembership,
  requireGarageMember,
  requireGarageOwner,
  requireSuperAdmin,
} = await import("./dal");

async function captureRedirectUrl(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (err) {
    if (err instanceof RedirectSignal) return err.url;
    throw err;
  }
  throw new Error("Expected a redirect, but none was thrown");
}

beforeEach(() => {
  redirectMock.mockClear();
  profileResult = { data: null };
  ownedGarageResult = { data: null };
  staffRowResult = { data: null };
});

describe("client-vs-garage separation: getGarageMembership", () => {
  it("returns null for a client role -- never reaches the garages/garage_staff lookups", async () => {
    profileResult = {
      data: { id: "user-1", role: "client", deleted_at: null },
    };

    const membership = await getGarageMembership("en");

    expect(membership).toBeNull();
    // A client account has no business being checked against garage
    // ownership or staff rows at all -- confirms this is a short-circuit,
    // not a query that happens to come back empty.
    expect(fakeSupabase.from).not.toHaveBeenCalledWith("garages");
    expect(fakeSupabase.from).not.toHaveBeenCalledWith("garage_staff");
  });

  it("returns isOwner: true for an admin_garage account that owns a garage", async () => {
    profileResult = {
      data: { id: "owner-1", role: "admin_garage", deleted_at: null },
    };
    ownedGarageResult = { data: { id: "garage-1", owner_id: "owner-1" } };

    const membership = await getGarageMembership("en");

    expect(membership).toEqual({
      profile: profileResult.data,
      garage: ownedGarageResult.data,
      isOwner: true,
    });
  });

  it("returns isOwner: false for a mecanicien attached via garage_staff", async () => {
    profileResult = {
      data: { id: "mech-1", role: "mecanicien", deleted_at: null },
    };
    ownedGarageResult = { data: null };
    staffRowResult = { data: { garages: { id: "garage-1" } } };

    const membership = await getGarageMembership("en");

    expect(membership).toEqual({
      profile: profileResult.data,
      garage: { id: "garage-1" },
      isOwner: false,
    });
  });

  it("returns null for a mecanicien with no owned garage and no staff row (e.g. removed from staff)", async () => {
    profileResult = {
      data: { id: "mech-1", role: "mecanicien", deleted_at: null },
    };
    ownedGarageResult = { data: null };
    staffRowResult = { data: null };

    const membership = await getGarageMembership("en");

    expect(membership).toBeNull();
  });
});

describe("unauthorized direct access: requireGarageMember / requireGarageOwner", () => {
  it("redirects a client account to /dashboard -- can never reach a garage-scoped action", async () => {
    profileResult = {
      data: { id: "user-1", role: "client", deleted_at: null },
    };

    const url = await captureRedirectUrl(requireGarageMember("en"));
    expect(url).toBe("/en/dashboard");
  });

  it("lets a garage-owning admin_garage account through requireGarageMember", async () => {
    profileResult = {
      data: { id: "owner-1", role: "admin_garage", deleted_at: null },
    };
    ownedGarageResult = { data: { id: "garage-1", owner_id: "owner-1" } };

    const result = await requireGarageMember("en");
    expect(result.isOwner).toBe(true);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects a mecanicien (staff, not owner) away from an owner-only action", async () => {
    profileResult = {
      data: { id: "mech-1", role: "mecanicien", deleted_at: null },
    };
    staffRowResult = { data: { garages: { id: "garage-1" } } };

    const url = await captureRedirectUrl(requireGarageOwner("en"));
    expect(url).toBe("/en/dashboard");
  });

  it("lets the actual owner through requireGarageOwner", async () => {
    profileResult = {
      data: { id: "owner-1", role: "admin_garage", deleted_at: null },
    };
    ownedGarageResult = { data: { id: "garage-1", owner_id: "owner-1" } };

    const result = await requireGarageOwner("en");
    expect(result.isOwner).toBe(true);
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("redirects a client attempting requireGarageOwner directly (skipping requireGarageMember's own redirect target)", async () => {
    profileResult = {
      data: { id: "user-1", role: "client", deleted_at: null },
    };

    const url = await captureRedirectUrl(requireGarageOwner("en"));
    expect(url).toBe("/en/dashboard");
  });
});

describe("unauthorized direct access: requireSuperAdmin", () => {
  it("redirects a garage owner (admin_garage) away from a super-admin-only action", async () => {
    profileResult = {
      data: { id: "owner-1", role: "admin_garage", deleted_at: null },
    };

    const url = await captureRedirectUrl(requireSuperAdmin("en"));
    expect(url).toBe("/en/dashboard");
  });

  it("redirects a client away from a super-admin-only action", async () => {
    profileResult = {
      data: { id: "user-1", role: "client", deleted_at: null },
    };

    const url = await captureRedirectUrl(requireSuperAdmin("en"));
    expect(url).toBe("/en/dashboard");
  });

  it("lets an actual super_admin through", async () => {
    profileResult = {
      data: { id: "admin-1", role: "super_admin", deleted_at: null },
    };

    const profile = await requireSuperAdmin("en");
    expect(profile.role).toBe("super_admin");
    expect(redirectMock).not.toHaveBeenCalled();
  });
});
