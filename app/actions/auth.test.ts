import { beforeEach, describe, expect, it, vi } from "vitest";

// Unlike app/actions/appointments.test.ts's redirect mock (safe there
// because none of the functions tested there call redirect() on their
// happy path), auth.ts's login() calls redirect() for the garage branch
// with NO `return` after it -- relying on Next's real redirect() throwing
// to unwind the stack immediately. A non-throwing mock would let execution
// fall through to the second redirect() call right after it and silently
// overwrite the captured URL. This mock throws, matching real behavior.
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

vi.mock("@/lib/origin", () => ({
  getOrigin: vi.fn().mockResolvedValue("https://rdv.example"),
}));

const rateLimitState = { allowed: true };
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => rateLimitState.allowed),
  getClientIp: vi.fn().mockResolvedValue("203.0.113.1"),
}));

const signUpCalls: unknown[] = [];
let signUpResult: { data: { session: unknown }; error: { message: string } | null } = {
  data: { session: null },
  error: null,
};
let signInResult: {
  data: { user: { id: string } } | null;
  error: { message: string } | null;
} = { data: null, error: null };
let resetPasswordResult: { error: { message: string } | null } = { error: null };
let profileRoleResult: { data: { role: string } | null } = { data: null };

const fakeSupabase = {
  auth: {
    signUp: vi.fn((args: unknown) => {
      signUpCalls.push(args);
      return Promise.resolve(signUpResult);
    }),
    signInWithPassword: vi.fn(() => Promise.resolve(signInResult)),
    resetPasswordForEmail: vi.fn(() => Promise.resolve(resetPasswordResult)),
  },
  from: vi.fn(() => ({
    select: () => ({
      eq: () => ({
        single: () => Promise.resolve(profileRoleResult),
      }),
    }),
  })),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(fakeSupabase),
}));

const { signup, garageSignup, login, requestPasswordReset } = await import(
  "./auth"
);

function formDataWith(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

/** Awaits an action expected to redirect, returning the redirected-to URL. */
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
  signUpCalls.length = 0;
  rateLimitState.allowed = true;
  signUpResult = { data: { session: null }, error: null };
  signInResult = { data: null, error: null };
  resetPasswordResult = { error: null };
  profileRoleResult = { data: null };
  fakeSupabase.auth.signUp.mockClear();
  fakeSupabase.auth.signInWithPassword.mockClear();
  fakeSupabase.auth.resetPasswordForEmail.mockClear();
  fakeSupabase.from.mockClear();
});

describe("role escalation: garageSignup never forwards a client-supplied role", () => {
  it("always sends role: admin_garage to signUp(), ignoring any role field the request includes", async () => {
    const formData = formDataWith({
      lang: "en",
      fullName: "Jane Doe",
      email: "jane@garage.example",
      password: "Password123",
      termsAccepted: "on",
      // An attacker tampering with the request -- garageSignup() never
      // reads this field at all (GarageSignupFormSchema has no `role` key).
      role: "super_admin",
    });

    await captureRedirectUrl(garageSignup(undefined, formData));

    expect(signUpCalls).toHaveLength(1);
    const call = signUpCalls[0] as { options: { data: { role: string } } };
    expect(call.options.data.role).toBe("admin_garage");
  });

  it("redirects to /garage/login?confirm=1 when no session is returned (confirmation required)", async () => {
    signUpResult = { data: { session: null }, error: null };
    const formData = formDataWith({
      lang: "en",
      fullName: "Jane Doe",
      email: "jane@garage.example",
      password: "Password123",
      termsAccepted: "on",
    });

    const url = await captureRedirectUrl(garageSignup(undefined, formData));
    expect(url).toBe("/en/garage/login?confirm=1");
  });
});

describe("role escalation: client signup() rejects any non-'client' role outright", () => {
  it("returns a validation error and never calls signUp() when role is tampered with", async () => {
    const formData = formDataWith({
      lang: "en",
      fullName: "Jane Doe",
      email: "jane@example.com",
      password: "Password123",
      termsAccepted: "on",
      role: "admin_garage",
    });

    const result = await signup(undefined, formData);

    expect(result?.errors?.role).toBeTruthy();
    expect(signUpCalls).toHaveLength(0);
  });

  it("always sends role: client to signUp() on a legitimate submission", async () => {
    const formData = formDataWith({
      lang: "en",
      fullName: "Jane Doe",
      email: "jane@example.com",
      password: "Password123",
      termsAccepted: "on",
      role: "client",
    });

    await captureRedirectUrl(signup(undefined, formData));

    const call = signUpCalls[0] as { options: { data: { role: string } } };
    expect(call.options.data.role).toBe("client");
  });
});

describe("confirmation: signUp session presence controls the redirect target", () => {
  it("garageSignup redirects straight to /garage/dashboard when a session is returned", async () => {
    signUpResult = { data: { session: { access_token: "x" } }, error: null };
    const formData = formDataWith({
      lang: "en",
      fullName: "Jane Doe",
      email: "jane@garage.example",
      password: "Password123",
      termsAccepted: "on",
    });

    const url = await captureRedirectUrl(garageSignup(undefined, formData));
    expect(url).toBe("/en/garage/dashboard");
  });

  it("client signup redirects to /dashboard when a session is returned, /login?confirm=1 otherwise", async () => {
    signUpResult = { data: { session: { access_token: "x" } }, error: null };
    const withSession = formDataWith({
      lang: "en",
      fullName: "Jane Doe",
      email: "jane@example.com",
      password: "Password123",
      termsAccepted: "on",
      role: "client",
    });
    expect(await captureRedirectUrl(signup(undefined, withSession))).toBe(
      "/en/dashboard"
    );

    signUpResult = { data: { session: null }, error: null };
    const withoutSession = formDataWith({
      lang: "en",
      fullName: "Jane Doe",
      email: "jane2@example.com",
      password: "Password123",
      termsAccepted: "on",
      role: "client",
    });
    expect(await captureRedirectUrl(signup(undefined, withoutSession))).toBe(
      "/en/login?confirm=1"
    );
  });

  it("garageSignup surfaces a rate-limit message and never calls signUp() when throttled", async () => {
    rateLimitState.allowed = false;
    const formData = formDataWith({
      lang: "en",
      fullName: "Jane Doe",
      email: "jane@garage.example",
      password: "Password123",
      termsAccepted: "on",
    });

    const result = await garageSignup(undefined, formData);

    expect(result?.message).toMatch(/too many/i);
    expect(signUpCalls).toHaveLength(0);
  });
});

describe("garage redirects: login() routes by the account's actual role", () => {
  it("redirects an admin_garage account to /garage/dashboard", async () => {
    signInResult = { data: { user: { id: "owner-1" } }, error: null };
    profileRoleResult = { data: { role: "admin_garage" } };

    const url = await captureRedirectUrl(
      login(
        undefined,
        formDataWith({ lang: "en", email: "owner@garage.example", password: "x" })
      )
    );

    expect(url).toBe("/en/garage/dashboard");
    // Only one redirect call -- confirms the function actually stopped at
    // the garage branch rather than falling through to the client branch
    // right after it.
    expect(redirectMock).toHaveBeenCalledTimes(1);
  });

  it("redirects a mecanicien account to /garage/dashboard", async () => {
    signInResult = { data: { user: { id: "mech-1" } }, error: null };
    profileRoleResult = { data: { role: "mecanicien" } };

    const url = await captureRedirectUrl(
      login(
        undefined,
        formDataWith({ lang: "en", email: "mech@garage.example", password: "x" })
      )
    );

    expect(url).toBe("/en/garage/dashboard");
  });

  it("redirects a client account to /dashboard, not /garage/dashboard", async () => {
    signInResult = { data: { user: { id: "client-1" } }, error: null };
    profileRoleResult = { data: { role: "client" } };

    const url = await captureRedirectUrl(
      login(
        undefined,
        formDataWith({ lang: "en", email: "client@example.com", password: "x" })
      )
    );

    expect(url).toBe("/en/dashboard");
  });

  it("uses the requested locale in the redirect", async () => {
    signInResult = { data: { user: { id: "owner-1" } }, error: null };
    profileRoleResult = { data: { role: "admin_garage" } };

    const url = await captureRedirectUrl(
      login(
        undefined,
        formDataWith({ lang: "fr", email: "owner@garage.example", password: "x" })
      )
    );

    expect(url).toBe("/fr/garage/dashboard");
  });
});

describe("authorization: login() never reaches the redirect on failed sign-in", () => {
  it("returns an error and calls redirect zero times on invalid credentials", async () => {
    signInResult = { data: null, error: { message: "Invalid login credentials" } };

    const result = await login(
      undefined,
      formDataWith({ lang: "en", email: "nobody@example.com", password: "wrong" })
    );

    expect(result?.message).toBeTruthy();
    expect(redirectMock).not.toHaveBeenCalled();
    expect(fakeSupabase.from).not.toHaveBeenCalled();
  });

  it("surfaces a rate-limit message and never calls signInWithPassword when throttled", async () => {
    rateLimitState.allowed = false;

    const result = await login(
      undefined,
      formDataWith({ lang: "en", email: "anyone@example.com", password: "x" })
    );

    expect(result?.message).toMatch(/too many/i);
    expect(fakeSupabase.auth.signInWithPassword).not.toHaveBeenCalled();
  });
});

describe("password reset: no account-enumeration signal, regardless of outcome", () => {
  it("returns the same neutral message whether or not the account exists", async () => {
    resetPasswordResult = { error: null };
    const existsResult = await requestPasswordReset(
      undefined,
      formDataWith({ lang: "en", email: "real-account@example.com" })
    );

    resetPasswordResult = { error: { message: "User not found" } };
    const missingResult = await requestPasswordReset(
      undefined,
      formDataWith({ lang: "en", email: "no-such-account@example.com" })
    );

    expect(existsResult?.message).toBe(missingResult?.message);
    expect(existsResult?.message).toMatch(/if an account exists/i);
  });

  it("is rate-limited by IP, not by the submitted email", async () => {
    rateLimitState.allowed = false;

    const result = await requestPasswordReset(
      undefined,
      formDataWith({ lang: "en", email: "anyone@example.com" })
    );

    expect(result?.message).toMatch(/too many/i);
    expect(fakeSupabase.auth.resetPasswordForEmail).not.toHaveBeenCalled();
  });
});
