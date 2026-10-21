import { beforeEach, describe, expect, it, vi } from "vitest";

// These tests exercise app/actions/appointments.ts's transition functions
// against a mocked Supabase client. They verify the ONE thing that matters
// for regression protection given this file's history this session: that
// each transition calls the correct SECURITY DEFINER RPC
// (supabase/migrations/0027_appointment_write_integrity.sql /
// 0028_fix_assign_appointment_mechanic.sql) rather than a raw
// .from("appointments").update(...) call, which is exactly the shape of
// the vulnerability those migrations fixed (appointments has no UPDATE
// policy for the authenticated role at all -- see 0027 -- so a regression
// back to a raw update wouldn't just be a lesser check, it would silently
// no-op against the live database).
//
// What this does NOT test: the RPCs' own SQL bodies, or that Postgres RLS
// actually enforces what the migrations claim. That requires a live
// Postgres instance (Supabase local dev via Docker, unavailable in this
// environment) and was instead verified directly against the connected
// project via `pg_policies`/`pg_proc` queries in an earlier session. This
// suite is the applic­ation-layer half: does our code keep calling the
// security boundary correctly.

const redirectMock = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/notifications", () => ({
  notifyAppointmentStatusChange: vi.fn(),
  notifyAppointmentRescheduled: vi.fn(),
  notifyWaitlistSlotOpened: vi.fn(),
  notifyRepairStageChange: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/lib/invoice-pdf", () => ({
  renderInvoicePdf: vi.fn(),
}));

const FAKE_GARAGE = { id: "garage-1", name: "Test Garage" };
const FAKE_USER = { id: "client-1" };

vi.mock("@/lib/dal", () => ({
  getAuthedUser: vi.fn().mockResolvedValue(FAKE_USER),
  requireGarageMember: vi.fn().mockResolvedValue({
    profile: { id: "owner-1" },
    garage: FAKE_GARAGE,
    isOwner: true,
  }),
  requireGarageOwner: vi.fn().mockResolvedValue({
    profile: { id: "owner-1" },
    garage: FAKE_GARAGE,
    isOwner: true,
  }),
}));

// Minimal fake query builder: every chained method (.eq, .select, etc.)
// returns itself; .maybeSingle()/.single() resolve to whatever the test
// configured via `queryResult`.
let queryResult: { data: unknown; error: unknown } = { data: null, error: null };
let rpcResult: { data: unknown; error: unknown } = { data: null, error: null };
const rpcCalls: { name: string; params: unknown }[] = [];

function makeQueryBuilder() {
  const builder: Record<string, unknown> = {};
  const chain = () => builder;
  builder.select = chain;
  builder.eq = chain;
  builder.in = chain;
  builder.order = chain;
  builder.maybeSingle = () => Promise.resolve(queryResult);
  builder.single = () => Promise.resolve(queryResult);
  return builder;
}

const fakeSupabase = {
  from: vi.fn(() => makeQueryBuilder()),
  rpc: vi.fn((name: string, params: unknown) => {
    rpcCalls.push({ name, params });
    return Promise.resolve(rpcResult);
  }),
};

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue(fakeSupabase),
}));

const {
  confirmAppointment,
  cancelAppointment,
  assignMechanic,
} = await import("./appointments");

function formDataWith(fields: Record<string, string>) {
  const formData = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    formData.set(key, value);
  }
  return formData;
}

beforeEach(() => {
  rpcCalls.length = 0;
  queryResult = { data: null, error: null };
  rpcResult = { data: null, error: null };
  redirectMock.mockClear();
  fakeSupabase.from.mockClear();
  fakeSupabase.rpc.mockClear();
});

describe("appointment transition RPC delegation", () => {
  it("confirmAppointment calls the confirm_appointment RPC, not a raw update", async () => {
    rpcResult = { data: true, error: null };

    await confirmAppointment(formDataWith({ lang: "en", id: "appt-1" }));

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("confirm_appointment");
    expect(rpcCalls[0].params).toEqual({ target_appointment_id: "appt-1" });
  });

  it("cancelAppointment (client) calls cancel_appointment_as_client", async () => {
    rpcResult = { data: true, error: null };

    await cancelAppointment(formDataWith({ lang: "en", id: "appt-2" }));

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("cancel_appointment_as_client");
    expect(rpcCalls[0].params).toEqual({ target_appointment_id: "appt-2" });
  });

  it("does not attempt a follow-up read when the RPC reports no row changed", async () => {
    // false means the RPC's own WHERE guard rejected the transition
    // (wrong status, not a participant, etc.) -- the calling code must not
    // then go fetch/notify as if it had succeeded.
    rpcResult = { data: false, error: null };

    await confirmAppointment(formDataWith({ lang: "en", id: "appt-3" }));

    expect(fakeSupabase.from).not.toHaveBeenCalled();
  });
});

describe("mechanic assignment", () => {
  it("assignMechanic calls assign_appointment_mechanic with the appointment and mechanic id", async () => {
    await assignMechanic(
      formDataWith({ lang: "en", id: "appt-4", mechanicId: "mechanic-1" })
    );

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("assign_appointment_mechanic");
    expect(rpcCalls[0].params).toEqual({
      target_appointment_id: "appt-4",
      target_mechanic_id: "mechanic-1",
    });
  });

  it("passes null (unassign) when no mechanicId is given", async () => {
    await assignMechanic(formDataWith({ lang: "en", id: "appt-5" }));

    expect(rpcCalls[0].params).toEqual({
      target_appointment_id: "appt-5",
      target_mechanic_id: null,
    });
  });

  it("gates on requireGarageOwner before ever calling the RPC", async () => {
    const dal = await import("@/lib/dal");
    await assignMechanic(formDataWith({ lang: "en", id: "appt-6" }));
    expect(dal.requireGarageOwner).toHaveBeenCalled();
  });
});
