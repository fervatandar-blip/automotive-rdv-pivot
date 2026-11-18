import { beforeEach, describe, expect, it, vi } from "vitest";

type Email = { to: string; subject: string; html: string };
type Push = { profileId: string; title: string; body: string };

const emails: Email[] = [];
const pushes: Push[] = [];
let profileRow: Record<string, unknown> | null = null;
let garageRow: Record<string, unknown> | null = null;

vi.mock("@/lib/email", async () => {
  const actual = await vi.importActual<typeof import("@/lib/email")>("@/lib/email");
  return {
    escapeHtml: actual.escapeHtml,
    sendEmail: vi.fn(async (email: Email) => {
      emails.push(email);
    }),
  };
});

vi.mock("@/lib/push", () => ({
  sendPushToProfile: vi.fn(async (push: Push) => {
    pushes.push(push);
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: table === "profiles" ? profileRow : garageRow, error: null }),
        }),
      }),
    }),
  }),
}));

const {
  notifyAppointmentStatusChange,
  notifyBookingConfirmed,
  notifyRepairStageChange,
  notifyWaitlistSlotOpened,
} = await import("./notifications");

const START = "2026-11-24T13:30:00Z"; // Tuesday 24 November, 14:30 in Luxembourg

const base = {
  recipientProfileId: "profile-1",
  recipientEmail: "client@example.com",
  recipientName: "Anne",
  otherPartyName: "Garage Central",
  serviceName: "Vidange",
  startTime: START,
};

beforeEach(() => {
  emails.length = 0;
  pushes.length = 0;
  profileRow = { preferred_locale: "fr", notify_repair_updates: true, notify_waitlist: true };
  garageRow = { notify_new_booking: true, notify_cancellation: true };
});

describe("notification language", () => {
  it("writes to a French-speaking client in French, with a French date in Luxembourg time", async () => {
    await notifyAppointmentStatusChange({ ...base, status: "confirmed" });

    expect(emails[0].subject).toBe("Votre rendez-vous est confirmé");
    expect(emails[0].html).toContain("Bonjour Anne,");
    expect(emails[0].html).toContain("mardi 24 novembre à 14:30");
    expect(pushes[0].title).toBe("Votre rendez-vous est confirmé");
  });

  it("writes to an English-speaking client in English, 24-hour clock", async () => {
    profileRow = { preferred_locale: "en" };
    await notifyAppointmentStatusChange({ ...base, status: "cancelled" });

    expect(emails[0].subject).toBe("Your appointment was cancelled");
    expect(emails[0].html).toContain("Hi Anne,");
    expect(emails[0].html).toContain("Tuesday 24 November at 14:30");
  });

  it("falls back to French when the profile can't be read", async () => {
    profileRow = null;
    await notifyBookingConfirmed({ ...base, recipient: "client" });
    expect(emails[0].subject).toBe("Votre réservation est confirmée");
  });

  it("uses the garage owner's language for garage notifications", async () => {
    profileRow = { preferred_locale: "en" };
    await notifyBookingConfirmed({ ...base, recipient: "garage", recipientGarageId: "garage-1" });
    expect(emails[0].subject).toBe("New booking");
  });

  it("escapes names in the email body but not in push text", async () => {
    await notifyAppointmentStatusChange({ ...base, status: "confirmed", recipientName: "<b>Anne</b>" });
    expect(emails[0].html).toContain("&lt;b&gt;Anne&lt;/b&gt;");
    expect(emails[0].html).not.toContain("<b>Anne</b>");
  });

  it("dates waitlist alerts by day only", async () => {
    await notifyWaitlistSlotOpened({
      recipientProfileId: "profile-1",
      recipientEmail: "client@example.com",
      recipientName: "Anne",
      garageName: "Garage Central",
      serviceName: "Vidange",
      date: "2026-11-24",
    });
    expect(emails[0].html).toContain("mardi 24 novembre");
    expect(emails[0].html).not.toContain("14:30");
  });
});

describe("opt-outs", () => {
  it("skips repair-stage updates for a client who turned them off", async () => {
    profileRow = { preferred_locale: "fr", notify_repair_updates: false };
    await notifyRepairStageChange({ ...base, stage: "ready_for_pickup" });
    expect(emails).toHaveLength(0);
    expect(pushes).toHaveLength(0);
  });

  it("sends repair-stage updates in the client's language otherwise", async () => {
    await notifyRepairStageChange({ ...base, stage: "ready_for_pickup" });
    expect(emails[0].subject).toBe("Votre véhicule est prêt à être récupéré");
  });

  it("respects a garage that turned off cancellation notices", async () => {
    garageRow = { notify_cancellation: false };
    await notifyAppointmentStatusChange({ ...base, status: "cancelled", recipientGarageId: "garage-1" });
    expect(emails).toHaveLength(0);
    expect(pushes).toHaveLength(0);
  });
});
