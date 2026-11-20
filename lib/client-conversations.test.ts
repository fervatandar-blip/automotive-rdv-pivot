import { describe, expect, it } from "vitest";
import { conversationKey, groupConversations, replyAppointment } from "./client-conversations";

const NOW = new Date("2026-06-15T12:00:00Z").getTime();

const appt = (id: string, garage: string, vehicle: string | null, start: string, status = "completed") => ({
  id,
  garage_id: garage,
  vehicle_id: vehicle,
  start_time: start,
  status,
});

const msg = (id: string, appointmentId: string, at: string, sender = "garage-user") => ({
  id,
  appointment_id: appointmentId,
  sender_id: sender,
  body: id,
  created_at: at,
});

describe("groupConversations", () => {
  it("groups bookings by workshop and vehicle and sums unread", () => {
    const result = groupConversations(
      [
        appt("a1", "g1", "v1", "2026-05-01T08:00:00Z"),
        appt("a2", "g1", "v1", "2026-06-20T08:00:00Z", "confirmed"),
        appt("a3", "g1", "v2", "2026-06-21T08:00:00Z", "confirmed"),
      ],
      [msg("m1", "a1", "2026-05-01T09:00:00Z")],
      new Map([
        ["a1", 1],
        ["a2", 2],
      ]),
      { now: NOW },
    );

    // v2's booking (Jun 21) is newer than v1's last message (May 1).
    expect(result.map((c) => c.key)).toEqual([conversationKey("g1", "v2"), conversationKey("g1", "v1")]);
    const v1 = result.find((c) => c.vehicleId === "v1")!;
    expect(v1.appointments.map((a) => a.id)).toEqual(["a1", "a2"]);
    expect(v1.unread).toBe(3);
    expect(v1.lastMessage?.id).toBe("m1");
  });

  it("drops past conversations nobody wrote in, keeps upcoming ones", () => {
    const result = groupConversations(
      [
        appt("old", "g1", "v1", "2026-01-01T08:00:00Z"),
        appt("next", "g2", null, "2026-06-30T08:00:00Z", "pending"),
        appt("gone", "g3", null, "2026-06-30T08:00:00Z", "cancelled"),
      ],
      [],
      new Map(),
      { now: NOW },
    );
    expect(result.map((c) => c.key)).toEqual(["g2:none"]);
  });

  it("keeps a past conversation the driver asked to open", () => {
    const result = groupConversations(
      [appt("old", "g1", "v1", "2026-01-01T08:00:00Z")],
      [],
      new Map(),
      { now: NOW, keepAppointmentId: "old" },
    );
    expect(result.map((c) => c.key)).toEqual(["g1:v1"]);
  });

  it("orders by latest message, falling back to the latest booking", () => {
    const result = groupConversations(
      [
        appt("a", "g1", null, "2026-06-16T08:00:00Z", "confirmed"),
        appt("b", "g2", null, "2026-03-01T08:00:00Z"),
      ],
      [msg("m", "b", "2026-06-17T08:00:00Z")],
      new Map(),
      { now: NOW },
    );
    expect(result.map((c) => c.garageId)).toEqual(["g2", "g1"]);
    expect(result[0].lastActivityAt).toBe("2026-06-17T08:00:00Z");
  });
});

describe("replyAppointment", () => {
  const [conversation] = groupConversations(
    [
      appt("past", "g1", "v1", "2026-05-01T08:00:00Z"),
      appt("soon", "g1", "v1", "2026-06-20T08:00:00Z", "confirmed"),
      appt("later", "g1", "v1", "2026-07-20T08:00:00Z", "confirmed"),
    ],
    [],
    new Map(),
    { now: NOW },
  );

  it("uses the requested booking when it belongs to the conversation", () => {
    expect(replyAppointment(conversation, "past", NOW).id).toBe("past");
  });

  it("falls back to the next booking ahead, ignoring foreign ids", () => {
    expect(replyAppointment(conversation, "elsewhere", NOW).id).toBe("soon");
    expect(replyAppointment(conversation, null, NOW).id).toBe("soon");
  });

  it("uses the most recent booking when none is ahead", () => {
    expect(replyAppointment(conversation, null, new Date("2026-08-01T00:00:00Z").getTime()).id).toBe("later");
  });
});
