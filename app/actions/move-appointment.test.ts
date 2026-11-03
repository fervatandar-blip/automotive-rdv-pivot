import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ getStripe: vi.fn() }));
vi.mock("@/lib/invoice-pdf", () => ({ renderInvoicePdf: vi.fn() }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: vi.fn() }));
vi.mock("@/lib/availability", () => ({ getAvailableSlotsForDate: vi.fn() }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/dal", () => ({
  requireGarageMember: vi.fn().mockResolvedValue({ garage: { id: "garage-1" }, isOwner: true }),
  requireGarageOwner: vi.fn(),
  getAuthedUser: vi.fn(),
}));

const notifyAppointmentRescheduled = vi.fn(() => Promise.resolve());
vi.mock("@/lib/notifications", () => ({
  notifyAppointmentRescheduled,
  notifyAppointmentStatusChange: vi.fn(),
  notifyBookingConfirmed: vi.fn(),
  notifyWaitlistSlotOpened: vi.fn(),
  notifyRepairStageChange: vi.fn(),
}));

const ID = "11111111-1111-4111-8111-111111111111";
const MECH_A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const MECH_B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

let appointmentRow: Record<string, unknown> | null;
let rpcResult: { data: unknown; error: { code: string; message: string } | null };
const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from(table: string) {
        const builder = {
          select: () => builder,
          eq: () => builder,
          maybeSingle: () =>
            Promise.resolve({
              data: table === "appointments" ? appointmentRow : { full_name: "Lea Muller" },
              error: null,
            }),
        };
        return builder;
      },
      rpc(name: string, args: Record<string, unknown>) {
        rpcCalls.push({ name, args });
        return Promise.resolve(rpcResult);
      },
    })
  ),
}));

const { moveAppointment } = await import("./appointments");

// A Wednesday far enough ahead that "past" never triggers; CET (UTC+1).
const DATE = "2030-11-06";

beforeEach(() => {
  rpcCalls.length = 0;
  notifyAppointmentRescheduled.mockClear();
  rpcResult = { data: MECH_A, error: null };
  appointmentRow = {
    id: ID,
    start_time: "2030-11-06T09:00:00Z", // 10:00 CET
    end_time: "2030-11-06T10:30:00Z", // 90 minutes
    status: "confirmed",
    assigned_mechanic_id: MECH_A,
    garage_id: "garage-1",
    client_id: "client-1",
    services: { name: "Oil change" },
    client: { full_name: "Ana Costa", email: "ana@example.com" },
    garage: { name: "Garage Centre", email: null, owner_id: "owner-1" },
  };
});

describe("moveAppointment", () => {
  it("keeps the job's length and sends local wall-clock times as instants", async () => {
    const result = await moveAppointment({ lang: "en", id: ID, date: DATE, time: "14:00" });
    expect(result).toEqual({ ok: true, mechanicName: "Lea Muller", mechanicChanged: false });
    expect(rpcCalls).toEqual([
      {
        name: "move_appointment",
        args: {
          target_appointment_id: ID,
          new_start: "2030-11-06T13:00:00.000Z",
          new_end: "2030-11-06T14:30:00.000Z",
          target_mechanic_id: null,
        },
      },
    ]);
  });

  it("emails a registered client about the new time", async () => {
    await moveAppointment({ lang: "en", id: ID, date: DATE, time: "14:00" });
    expect(notifyAppointmentRescheduled).toHaveBeenCalledOnce();
  });

  it("doesn't email anyone when only the mechanic changes", async () => {
    rpcResult = { data: MECH_B, error: null };
    const result = await moveAppointment({ lang: "en", id: ID, date: DATE, time: "10:00", mechanicId: MECH_B });
    expect(result).toMatchObject({ ok: true, mechanicChanged: true });
    expect(rpcCalls[0].args.target_mechanic_id).toBe(MECH_B);
    expect(notifyAppointmentRescheduled).not.toHaveBeenCalled();
  });

  it("resizes by pinning the current mechanic, without emailing the client", async () => {
    const result = await moveAppointment({
      lang: "en",
      id: ID,
      date: DATE,
      time: "10:00",
      durationMinutes: 120,
    });
    expect(result).toMatchObject({ ok: true, mechanicChanged: false });
    expect(rpcCalls[0].args).toEqual({
      target_appointment_id: ID,
      new_start: "2030-11-06T09:00:00.000Z",
      new_end: "2030-11-06T11:00:00.000Z",
      target_mechanic_id: MECH_A,
    });
    // Same start time: nothing the client needs to hear about.
    expect(notifyAppointmentRescheduled).not.toHaveBeenCalled();
  });

  it("rejects a resize below the minimum or off the 5-minute grid", async () => {
    for (const durationMinutes of [10, 47, 0]) {
      expect(
        await moveAppointment({ lang: "en", id: ID, date: DATE, time: "10:00", durationMinutes })
      ).toEqual({ ok: false, error: "invalid" });
    }
  });

  it("refuses completed or cancelled jobs without calling the database function", async () => {
    appointmentRow = { ...appointmentRow, status: "completed" };
    expect(await moveAppointment({ lang: "en", id: ID, date: DATE, time: "14:00" })).toEqual({
      ok: false,
      error: "not-movable",
    });
    expect(rpcCalls).toHaveLength(0);
  });

  it("refuses times in the past", async () => {
    expect(await moveAppointment({ lang: "en", id: ID, date: "2020-01-08", time: "10:00" })).toEqual({
      ok: false,
      error: "past",
    });
  });

  it("refuses a move that would run past midnight", async () => {
    expect(await moveAppointment({ lang: "en", id: ID, date: DATE, time: "23:00" })).toEqual({
      ok: false,
      error: "crosses-midnight",
    });
  });

  it("rejects malformed input", async () => {
    expect(await moveAppointment({ lang: "en", id: "nope", date: DATE, time: "10:00" })).toEqual({
      ok: false,
      error: "invalid",
    });
    expect(await moveAppointment({ lang: "en", id: ID, date: DATE, time: "25:00" })).toEqual({
      ok: false,
      error: "invalid",
    });
  });

  it.each([
    [{ code: "23P01", message: "mechanic_unavailable" }, "mechanic-busy"],
    [{ code: "23P01", message: "no_mechanic_available" }, "no-mechanic"],
    [{ code: "42501", message: "owner_only" }, "owner-only"],
    [{ code: "XX000", message: "boom" }, "error"],
  ])("maps database error %o to %s", async (error, key) => {
    rpcResult = { data: null, error };
    expect(await moveAppointment({ lang: "en", id: ID, date: DATE, time: "14:00" })).toEqual({
      ok: false,
      error: key,
    });
    expect(notifyAppointmentRescheduled).not.toHaveBeenCalled();
  });
});
