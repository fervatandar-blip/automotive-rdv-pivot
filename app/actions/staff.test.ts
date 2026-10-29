import { beforeEach, describe, expect, it, vi } from "vitest";

// Throwing redirect, like Next's real one -- the accept/decline actions
// rely on it to stop execution.
class RedirectSignal extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/origin", () => ({
  getOrigin: vi.fn().mockResolvedValue("https://rdv.example"),
}));

const rateLimit = { allowed: true };
vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: vi.fn(() => Promise.resolve(rateLimit.allowed)),
}));

const sentEmails: { to: string; subject: string; html: string }[] = [];
vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    escapeHtml: actual.escapeHtml,
    sendEmail: vi.fn((email: { to: string; subject: string; html: string }) => {
      sentEmails.push(email);
      return Promise.resolve();
    }),
  };
});

const OWNER = { id: "owner-1" };
const GARAGE = { id: "garage-1", name: "Garage <b>Bad</b> & Co", owner_id: "owner-1" };
vi.mock("@/lib/dal", () => ({
  requireGarageOwner: vi.fn().mockResolvedValue({
    profile: OWNER,
    garage: GARAGE,
    isOwner: true,
  }),
  getAuthedUser: vi.fn().mockResolvedValue({ id: "mech-1" }),
}));

/**
 * Minimal chainable query-builder fake: records every call on every table
 * so tests can assert what was (and wasn't) touched, and resolves with
 * whatever the test configured for that table+operation.
 */
type Op = { table: string; method: string; args: unknown[] };
function makeClient(results: Record<string, unknown>, ops: Op[], extra: object = {}) {
  return {
    from(table: string) {
      let operation = "select";
      const builder: Record<string, unknown> = {};
      const chain = (method: string) =>
        (...args: unknown[]) => {
          ops.push({ table, method, args });
          if (["insert", "update", "delete", "select"].includes(method) && operation === "select") {
            operation = method;
          }
          return builder;
        };
      for (const method of ["insert", "update", "delete", "select", "eq", "is", "gt", "in", "limit", "order"]) {
        builder[method] = chain(method);
      }
      builder.single = () => Promise.resolve(results[`${table}.${operation}`] ?? { data: null, error: null });
      builder.then = (resolve: (value: unknown) => unknown) =>
        Promise.resolve(results[`${table}.${operation}`] ?? { data: null, error: null }).then(resolve);
      return builder;
    },
    ...extra,
  };
}

let userOps: Op[];
let adminOps: Op[];
let userResults: Record<string, unknown>;
let adminResults: Record<string, unknown>;
let inviteUserByEmailResult: {
  data: { user: { id: string } | null };
  error: { code?: string; message: string } | null;
};
let rpcResult: { data: unknown; error: unknown };
const rpcCalls: { name: string; args: unknown }[] = [];
// Appointment ids whose reassignment RPC should fail (no free mechanic).
const rpcErrorsFor = new Set<string>();
const inviteUserByEmail = vi.fn(() => Promise.resolve(inviteUserByEmailResult));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve(
      makeClient(userResults, userOps, {
        rpc: (name: string, args: unknown) => {
          rpcCalls.push({ name, args });
          const target = (args as { target_appointment_id?: string })?.target_appointment_id;
          if (name === "assign_appointment_mechanic" && target && rpcErrorsFor.has(target)) {
            return Promise.resolve({ data: null, error: { code: "23P01", message: "no_mechanic_available" } });
          }
          return Promise.resolve(rpcResult);
        },
      })
    )
  ),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() =>
    makeClient(adminResults, adminOps, { auth: { admin: { inviteUserByEmail } } })
  ),
}));

const { inviteMechanic, acceptMechanicInvite, removeMechanic, setOwnerTakesBookings } = await import("./staff");

function inviteForm(email = "Jean.Dupont@Example.com") {
  const formData = new FormData();
  formData.set("lang", "en");
  formData.set("fullName", "Jean Dupont");
  formData.set("email", email);
  return formData;
}

async function redirectedTo(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("expected a redirect");
}

beforeEach(() => {
  userOps = [];
  adminOps = [];
  sentEmails.length = 0;
  rpcCalls.length = 0;
  rateLimit.allowed = true;
  inviteUserByEmail.mockClear();
  userResults = { "garage_invites.insert": { data: { id: "invite-1" }, error: null } };
  adminResults = {
    "profiles.update": { error: null },
    "profiles.select": { data: [], error: null },
  };
  inviteUserByEmailResult = { data: { user: { id: "new-user" } }, error: null };
  rpcResult = { data: "accepted", error: null };
  rpcErrorsFor.clear();
});

describe("inviteMechanic: no account enumeration", () => {
  it("returns the identical response for a new email, an existing mécanicien, and an existing non-mécanicien", async () => {
    const newAccount = await inviteMechanic(undefined, inviteForm());

    inviteUserByEmailResult = {
      data: { user: null },
      error: { code: "email_exists", message: "A user with this email address has already been registered" },
    };
    adminResults["profiles.select"] = { data: [{ role: "mecanicien" }], error: null };
    const existingMechanic = await inviteMechanic(undefined, inviteForm());

    adminResults["profiles.select"] = { data: [], error: null };
    const existingClient = await inviteMechanic(undefined, inviteForm());

    expect(newAccount).toEqual({ sentTo: "jean.dupont@example.com" });
    expect(existingMechanic).toEqual(newAccount);
    expect(existingClient).toEqual(newAccount);
  });
});

describe("inviteMechanic: grants nothing", () => {
  it("stores a pending invite keyed by the lower-cased email, under the owner's own session", async () => {
    await inviteMechanic(undefined, inviteForm());

    const insert = userOps.find((op) => op.table === "garage_invites" && op.method === "insert");
    expect(insert?.args[0]).toEqual({
      garage_id: GARAGE.id,
      email: "jean.dupont@example.com",
      invited_by: OWNER.id,
    });
  });

  it("never writes garage_staff, with either client", async () => {
    await inviteMechanic(undefined, inviteForm());
    inviteUserByEmailResult = { data: { user: null }, error: { code: "email_exists", message: "exists" } };
    adminResults["profiles.select"] = { data: [{ role: "mecanicien" }], error: null };
    await inviteMechanic(undefined, inviteForm());

    expect([...userOps, ...adminOps].some((op) => op.table === "garage_staff")).toBe(false);
  });

  it("never changes the role of an existing account", async () => {
    inviteUserByEmailResult = { data: { user: null }, error: { code: "email_exists", message: "exists" } };
    adminResults["profiles.select"] = { data: [{ role: "client" }], error: null };
    await inviteMechanic(undefined, inviteForm());

    expect(adminOps.some((op) => op.table === "profiles" && op.method === "update")).toBe(false);
  });

  it("grants mécanicien only to the account the invite itself just created", async () => {
    await inviteMechanic(undefined, inviteForm());

    const update = adminOps.find((op) => op.table === "profiles" && op.method === "update");
    expect(update?.args[0]).toEqual({ role: "mecanicien" });
    const scoped = adminOps.find(
      (op) => op.table === "profiles" && op.method === "eq" && op.args[0] === "id"
    );
    expect(scoped?.args[1]).toBe("new-user");
  });
});

describe("inviteMechanic: notification email", () => {
  it("emails an existing mécanicien, with the garage name HTML-escaped", async () => {
    inviteUserByEmailResult = { data: { user: null }, error: { code: "email_exists", message: "exists" } };
    adminResults["profiles.select"] = { data: [{ role: "mecanicien" }], error: null };

    await inviteMechanic(undefined, inviteForm());

    expect(sentEmails).toHaveLength(1);
    expect(sentEmails[0].to).toBe("jean.dupont@example.com");
    expect(sentEmails[0].html).toContain("Garage &lt;b&gt;Bad&lt;/b&gt; &amp; Co");
    expect(sentEmails[0].html).not.toContain("<b>Bad</b>");
  });

  it("does not email an existing account that isn't a mécanicien", async () => {
    inviteUserByEmailResult = { data: { user: null }, error: { code: "email_exists", message: "exists" } };
    adminResults["profiles.select"] = { data: [], error: null };

    await inviteMechanic(undefined, inviteForm());

    expect(sentEmails).toHaveLength(0);
  });
});

describe("inviteMechanic: failure paths", () => {
  it("reports an already-pending invite without contacting the auth API", async () => {
    userResults["garage_invites.insert"] = { data: null, error: { code: "23505" } };

    const result = await inviteMechanic(undefined, inviteForm());

    expect(result).toEqual({ message: "An invitation to that email is already pending." });
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("is rate-limited per garage before anything is written", async () => {
    rateLimit.allowed = false;

    const result = await inviteMechanic(undefined, inviteForm());

    expect(result?.message).toMatch(/too many invitations/i);
    expect(userOps).toHaveLength(0);
    expect(inviteUserByEmail).not.toHaveBeenCalled();
  });

  it("rolls back the invite row if the auth invite fails for another reason", async () => {
    inviteUserByEmailResult = { data: { user: null }, error: { message: "SMTP unavailable" } };

    const result = await inviteMechanic(undefined, inviteForm());

    expect(result).toEqual({ message: "Could not send the invite. Try again." });
    expect(userOps.some((op) => op.table === "garage_invites" && op.method === "delete")).toBe(true);
  });

  it("rejects an invalid email before doing anything", async () => {
    const result = await inviteMechanic(undefined, inviteForm("not-an-email"));

    expect(result?.errors?.email).toBeDefined();
    expect(userOps).toHaveLength(0);
  });
});

describe("acceptMechanicInvite", () => {
  function acceptForm(inviteId = "invite-1") {
    const formData = new FormData();
    formData.set("lang", "en");
    formData.set("inviteId", inviteId);
    return formData;
  }

  it("goes through the accept_garage_invite RPC, never a direct table write", async () => {
    await redirectedTo(acceptMechanicInvite(acceptForm()));

    expect(rpcCalls).toEqual([{ name: "accept_garage_invite", args: { target_invite_id: "invite-1" } }]);
    expect(userOps).toHaveLength(0);
  });

  it("lands on the plain dashboard on success", async () => {
    expect(await redirectedTo(acceptMechanicInvite(acceptForm()))).toBe("/en/garage/dashboard");
  });

  it.each(["not_found", "not_mechanic", "already_staff"])(
    "surfaces the %s outcome on the dashboard",
    async (outcome) => {
      rpcResult = { data: outcome, error: null };
      expect(await redirectedTo(acceptMechanicInvite(acceptForm()))).toBe(
        `/en/garage/dashboard?invite=${outcome}`
      );
    }
  );

  it("maps an unexpected RPC value or error to a generic error", async () => {
    rpcResult = { data: "something-else", error: null };
    expect(await redirectedTo(acceptMechanicInvite(acceptForm()))).toBe(
      "/en/garage/dashboard?invite=error"
    );

    rpcResult = { data: null, error: { message: "boom" } };
    expect(await redirectedTo(acceptMechanicInvite(acceptForm()))).toBe(
      "/en/garage/dashboard?invite=error"
    );
  });
});

describe("mechanic capacity changes reassign upcoming jobs", () => {
  function staffForm(fields: Record<string, string>) {
    const formData = new FormData();
    formData.set("lang", "en");
    for (const [key, value] of Object.entries(fields)) formData.set(key, value);
    return formData;
  }

  it("removing a mechanic hands each upcoming job to the auto-assigner and reports what's stranded", async () => {
    userResults["appointments.select"] = { data: [{ id: "job-1" }, { id: "job-2" }, { id: "job-3" }], error: null };
    rpcErrorsFor.add("job-2");

    const url = await redirectedTo(removeMechanic(staffForm({ profileId: "mech-9" })));

    expect(userOps.some((op) => op.table === "garage_staff" && op.method === "delete")).toBe(true);
    const reassigned = rpcCalls.filter((call) => call.name === "assign_appointment_mechanic");
    expect(reassigned.map((call) => call.args)).toEqual([
      { target_appointment_id: "job-1", target_mechanic_id: null },
      { target_appointment_id: "job-2", target_mechanic_id: null },
      { target_appointment_id: "job-3", target_mechanic_id: null },
    ]);
    // Only that mechanic's upcoming, active jobs at this garage.
    const filters = userOps.filter((op) => op.table === "appointments").map((op) => [op.method, ...op.args]);
    expect(filters).toContainEqual(["eq", "assigned_mechanic_id", "mech-9"]);
    expect(filters).toContainEqual(["eq", "garage_id", "garage-1"]);
    expect(url).toBe("/en/garage/staff?moved=2&stranded=1");
  });

  it("opting the owner out reassigns the owner's upcoming jobs", async () => {
    userResults["appointments.select"] = { data: [{ id: "job-1" }], error: null };

    const url = await redirectedTo(setOwnerTakesBookings(staffForm({})));

    const update = userOps.find((op) => op.table === "garages" && op.method === "update");
    expect(update?.args[0]).toEqual({ owner_takes_bookings: false });
    expect(userOps.filter((op) => op.table === "appointments").map((op) => [op.method, ...op.args])).toContainEqual([
      "eq",
      "assigned_mechanic_id",
      "owner-1",
    ]);
    expect(url).toBe("/en/garage/staff?moved=1");
  });

  it("opting the owner back in reassigns nothing", async () => {
    const url = await redirectedTo(setOwnerTakesBookings(staffForm({ takesBookings: "on" })));

    expect(userOps.find((op) => op.table === "garages" && op.method === "update")?.args[0]).toEqual({
      owner_takes_bookings: true,
    });
    expect(rpcCalls).toHaveLength(0);
    expect(url).toBe("/en/garage/staff");
  });
});
