import { describe, expect, it } from "vitest";
import { agendaBadge, computeDayCapacity, formatMinutes, isOpenAt, mechanicStatus } from "@/lib/dashboard";
import { zonedDateTimeToUtc } from "@/lib/timezone";

const DATE = "2026-11-03"; // a Tuesday, CET (UTC+1)
const at = (time: string) => zonedDateTimeToUtc(DATE, time).toISOString();

describe("agendaBadge", () => {
  const now = new Date(at("10:00"));

  it("marks pending bookings as awaiting action", () => {
    expect(agendaBadge({ status: "pending", repair_stage: null, start_time: at("14:00") }, now)).toBe(
      "awaiting_action"
    );
  });

  it("keeps a future confirmed booking with no stage as confirmed", () => {
    expect(agendaBadge({ status: "confirmed", repair_stage: null, start_time: at("14:00") }, now)).toBe(
      "confirmed"
    );
  });

  it("treats a confirmed booking with a repair stage as in progress, even before its start", () => {
    expect(
      agendaBadge({ status: "confirmed", repair_stage: "received", start_time: at("14:00") }, now)
    ).toBe("in_progress");
  });

  it("treats a confirmed booking whose start has passed as in progress", () => {
    expect(agendaBadge({ status: "confirmed", repair_stage: null, start_time: at("09:30") }, now)).toBe(
      "in_progress"
    );
  });

  it("passes completed and cancelled through", () => {
    expect(agendaBadge({ status: "completed", repair_stage: "ready_for_pickup", start_time: at("08:00") }, now)).toBe(
      "completed"
    );
    expect(agendaBadge({ status: "cancelled", repair_stage: null, start_time: at("08:00") }, now)).toBe("cancelled");
  });
});

describe("computeDayCapacity", () => {
  const splitShift = [
    { start_time: "08:00:00", end_time: "12:00:00" },
    { start_time: "13:00:00", end_time: "17:00:00" },
  ];

  it("reports closed when there are no opening windows", () => {
    expect(computeDayCapacity({ date: DATE, windows: [], mechanicCount: 3, bookings: [] })).toEqual({
      kind: "closed",
    });
  });

  it("reports no mechanics before reporting a load", () => {
    expect(computeDayCapacity({ date: DATE, windows: splitShift, mechanicCount: 0, bookings: [] })).toEqual({
      kind: "no_mechanics",
    });
  });

  it("multiplies opening minutes by mechanics and counts booked minutes", () => {
    const result = computeDayCapacity({
      date: DATE,
      windows: splitShift,
      mechanicCount: 2,
      bookings: [
        { start_time: at("08:00"), end_time: at("10:00") },
        { start_time: at("08:00"), end_time: at("09:00") },
      ],
    });
    expect(result).toEqual({ kind: "open", bookedMinutes: 180, capacityMinutes: 960, percent: 19 });
  });

  it("only counts the part of a booking inside opening hours (lunch break excluded)", () => {
    const result = computeDayCapacity({
      date: DATE,
      windows: splitShift,
      mechanicCount: 1,
      bookings: [{ start_time: at("11:00"), end_time: at("14:00") }],
    });
    expect(result).toMatchObject({ bookedMinutes: 120, capacityMinutes: 480 });
  });

  it("clamps the percentage at 100", () => {
    const result = computeDayCapacity({
      date: DATE,
      windows: [{ start_time: "08:00:00", end_time: "09:00:00" }],
      mechanicCount: 1,
      bookings: [
        { start_time: at("08:00"), end_time: at("09:00") },
        { start_time: at("08:00"), end_time: at("09:00") },
      ],
    });
    expect(result).toMatchObject({ kind: "open", percent: 100 });
  });
});

describe("formatMinutes", () => {
  it("formats minutes, hours and mixed durations", () => {
    expect(formatMinutes(45)).toBe("45 min");
    expect(formatMinutes(60)).toBe("1 h");
    expect(formatMinutes(90)).toBe("1 h 30");
    expect(formatMinutes(605)).toBe("10 h 05");
  });
});

describe("isOpenAt", () => {
  const windows = [
    { start_time: "08:00:00", end_time: "12:00:00" },
    { start_time: "13:00:00", end_time: "17:00:00" },
  ];

  it("is open inside a window and closed over lunch", () => {
    expect(isOpenAt({ date: DATE, windows, now: new Date(at("09:00")) })).toBe(true);
    expect(isOpenAt({ date: DATE, windows, now: new Date(at("12:30")) })).toBe(false);
  });

  it("treats a window's end as closed", () => {
    expect(isOpenAt({ date: DATE, windows, now: new Date(at("17:00")) })).toBe(false);
  });
});

describe("mechanicStatus", () => {
  const job = (start: string, end: string, status = "confirmed", mechanic = "m1") => ({
    assigned_mechanic_id: mechanic,
    status,
    start_time: at(start),
    end_time: at(end),
  });

  it("is busy until the current job ends", () => {
    expect(
      mechanicStatus({ mechanicId: "m1", appointments: [job("09:00", "10:30")], now: new Date(at("10:00")), shopOpen: true })
    ).toEqual({ kind: "busy", until: at("10:30") });
  });

  it("is free with the next job when between jobs", () => {
    expect(
      mechanicStatus({
        mechanicId: "m1",
        appointments: [job("14:00", "15:00"), job("08:00", "09:00"), job("11:00", "12:00")],
        now: new Date(at("10:00")),
        shopOpen: true,
      })
    ).toEqual({ kind: "free", nextAt: at("11:00") });
  });

  it("ignores completed, cancelled and other mechanics' jobs", () => {
    expect(
      mechanicStatus({
        mechanicId: "m1",
        appointments: [job("09:00", "11:00", "completed"), job("09:00", "11:00", "cancelled"), job("09:00", "11:00", "confirmed", "m2")],
        now: new Date(at("10:00")),
        shopOpen: true,
      })
    ).toEqual({ kind: "free", nextAt: null });
  });

  it("is off when the shop is closed and nothing is running", () => {
    expect(
      mechanicStatus({ mechanicId: "m1", appointments: [job("13:00", "14:00")], now: new Date(at("12:15")), shopOpen: false })
    ).toEqual({ kind: "off", nextAt: at("13:00") });
  });
});
