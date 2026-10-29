import { describe, expect, it } from "vitest";
import { computeAvailableSlots } from "./slots";

// All instants below carry explicit offsets: windows and `date` are
// Europe/Luxembourg wall-clock values, and 2026-06-01 is in CEST (UTC+2).
// The suite runs with TZ=UTC (vitest.config.ts), like Vercel, so any code
// that parses wall-clock times in the process zone fails here.

// Fixed reference "now" well before any slot under test, so slots aren't
// dropped as already-past unless a test deliberately exercises that path.
const EARLY_NOW = new Date("2020-01-01T00:00:00Z");

describe("computeAvailableSlots", () => {
  it("generates one slot per duration-sized step across a window", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [{ start_time: "09:00:00", end_time: "10:00:00" }],
      durationMinutes: 30,
      bookedRanges: [],
      now: EARLY_NOW,
    });

    expect(slots).toEqual(["09:00", "09:30"]);
  });

  it("drops a trailing slot that doesn't fully fit before the window ends", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [{ start_time: "09:00:00", end_time: "09:45:00" }],
      durationMinutes: 30,
      bookedRanges: [],
      now: EARLY_NOW,
    });

    // 09:00-09:30 fits; 09:30-10:00 would run past the 09:45 window end.
    expect(slots).toEqual(["09:00"]);
  });

  it("excludes a slot that overlaps an existing booking (booking-conflict avoidance)", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [{ start_time: "09:00:00", end_time: "11:00:00" }],
      durationMinutes: 30,
      bookedRanges: [
        {
          start: new Date("2026-06-01T09:30:00+02:00"),
          end: new Date("2026-06-01T10:00:00+02:00"),
        },
      ],
      now: EARLY_NOW,
    });

    expect(slots).not.toContain("09:30");
    expect(slots).toEqual(["09:00", "10:00", "10:30"]);
  });

  it("excludes a slot that only partially overlaps a booking at either edge", () => {
    // A booking from 09:15-09:45 partially overlaps both the 09:00 and
    // 09:30 candidate slots -- both must be dropped, not just the one
    // that starts inside the booking.
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [{ start_time: "09:00:00", end_time: "10:00:00" }],
      durationMinutes: 30,
      bookedRanges: [
        {
          start: new Date("2026-06-01T09:15:00+02:00"),
          end: new Date("2026-06-01T09:45:00+02:00"),
        },
      ],
      now: EARLY_NOW,
    });

    expect(slots).toEqual([]);
  });

  it("treats a booking stored as a UTC instant as local time, not as server-local time", () => {
    // The 09:00 Luxembourg slot is stored as 07:00Z. Under the old
    // server-local parsing on a UTC server, 09:00 meant 09:00Z, so this
    // booking wouldn't have blocked it and the 11:00 slot would have been
    // the one wrongly dropped.
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [{ start_time: "09:00:00", end_time: "12:00:00" }],
      durationMinutes: 60,
      bookedRanges: [
        {
          start: new Date("2026-06-01T07:00:00Z"),
          end: new Date("2026-06-01T08:00:00Z"),
        },
      ],
      now: EARLY_NOW,
    });

    expect(slots).toEqual(["10:00", "11:00"]);
  });

  it("drops slots that start at or before the current time", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [{ start_time: "09:00:00", end_time: "10:00:00" }],
      durationMinutes: 30,
      bookedRanges: [],
      now: new Date("2026-06-01T09:30:00+02:00"),
    });

    expect(slots).toEqual([]);
  });

  it("judges 'already passed' against local time, not the UTC wall clock", () => {
    // At 08:30Z it's 10:30 in Luxembourg: 10:00 is gone, 11:00 is not. A
    // UTC-parsing implementation would think 10:00 (= 10:00Z) is still ahead.
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [{ start_time: "10:00:00", end_time: "12:00:00" }],
      durationMinutes: 60,
      bookedRanges: [],
      now: new Date("2026-06-01T08:30:00Z"),
    });

    expect(slots).toEqual(["11:00"]);
  });

  it("uses the winter offset (CET, UTC+1) outside DST", () => {
    const slots = computeAvailableSlots({
      date: "2026-01-15",
      windows: [{ start_time: "09:00:00", end_time: "11:00:00" }],
      durationMinutes: 60,
      bookedRanges: [
        {
          start: new Date("2026-01-15T08:00:00Z"), // 09:00 CET
          end: new Date("2026-01-15T09:00:00Z"),
        },
      ],
      now: EARLY_NOW,
    });

    expect(slots).toEqual(["10:00"]);
  });

  it("computes slots independently across multiple windows on the same date", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [
        { start_time: "09:00:00", end_time: "09:30:00" },
        { start_time: "14:00:00", end_time: "14:30:00" },
      ],
      durationMinutes: 30,
      bookedRanges: [],
      now: EARLY_NOW,
    });

    expect(slots).toEqual(["09:00", "14:00"]);
  });

  it("never offers a lunch-break slot in a split shift", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [
        { start_time: "13:30:00", end_time: "15:00:00" },
        { start_time: "08:00:00", end_time: "12:00:00" },
      ],
      durationMinutes: 60,
      bookedRanges: [],
      now: EARLY_NOW,
    });

    // 11:00-12:00 is the last morning slot; nothing until 13:30.
    expect(slots).toEqual(["08:00", "09:00", "10:00", "11:00", "13:30"]);
  });

  it("doesn't let a service run across the lunch break", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [
        { start_time: "08:00:00", end_time: "12:00:00" },
        { start_time: "13:30:00", end_time: "18:00:00" },
      ],
      durationMinutes: 90,
      bookedRanges: [],
      now: EARLY_NOW,
    });

    // 11:00 + 90 min would end at 12:30, inside the break.
    expect(slots).not.toContain("11:00");
    expect(slots).toEqual(["08:00", "09:30", "13:30", "15:00", "16:30"]);
  });

  it("de-duplicates and sorts slots when windows repeat or arrive out of order", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [
        { start_time: "14:00:00", end_time: "15:00:00" },
        { start_time: "09:00:00", end_time: "10:00:00" },
        { start_time: "09:00:00", end_time: "10:00:00" },
      ],
      durationMinutes: 60,
      bookedRanges: [],
      now: EARLY_NOW,
    });

    expect(slots).toEqual(["09:00", "14:00"]);
  });

  it("returns no slots for an empty window list (e.g. a closed override day)", () => {
    const slots = computeAvailableSlots({
      date: "2026-06-01",
      windows: [],
      durationMinutes: 30,
      bookedRanges: [],
      now: EARLY_NOW,
    });

    expect(slots).toEqual([]);
  });
});
