import { describe, expect, it } from "vitest";
import {
  MIN_JOB_MINUTES,
  resizeEndMinutes,
  closedIntervals,
  dropStartMinutes,
  minutesToTime,
  groupByMechanic,
  parseDayLayout,
  hourRange,
  layoutDayEvents,
  minutesOnDate,
  monthGridDates,
  navigationTargets,
  parseCalendarView,
  shiftMonth,
  weekDates,
} from "@/lib/calendar-grid";

describe("week and month dates (Monday first)", () => {
  it("returns Monday to Sunday around any day", () => {
    expect(weekDates("2026-11-04")).toEqual([
      "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08",
    ]);
    // A Sunday belongs to the week that started the Monday before.
    expect(weekDates("2026-11-08")[0]).toBe("2026-11-02");
  });

  it("builds a 42-day month grid starting on the Monday on/before the 1st", () => {
    const grid = monthGridDates("2026-11-17");
    expect(grid).toHaveLength(42);
    expect(grid[0]).toBe("2026-10-26");
    expect(grid).toContain("2026-11-30");
  });

  it("steps months across year boundaries", () => {
    expect(shiftMonth("2026-12-15", 1)).toBe("2027-01-01");
    expect(shiftMonth("2026-01-31", -1)).toBe("2025-12-01");
  });

  it("navigates by day, week or month", () => {
    expect(navigationTargets("day", "2026-11-04")).toEqual({ prev: "2026-11-03", next: "2026-11-05" });
    expect(navigationTargets("week", "2026-11-04")).toEqual({ prev: "2026-10-28", next: "2026-11-11" });
    expect(navigationTargets("list", "2026-11-04").next).toBe("2026-11-11");
    expect(navigationTargets("month", "2026-11-04")).toEqual({ prev: "2026-10-01", next: "2026-12-01" });
  });

  it("defaults unknown views to week", () => {
    expect(parseCalendarView("agenda")).toBe("week");
    expect(parseCalendarView("day")).toBe("day");
  });
});

describe("hourRange", () => {
  it("defaults to 08:00-18:00", () => {
    expect(hourRange({ windows: [], events: [] })).toEqual({ startHour: 8, endHour: 18 });
  });

  it("widens to opening hours and to every appointment, rounded to whole hours", () => {
    expect(
      hourRange({
        windows: [{ start_time: "07:30:00", end_time: "12:00:00" }],
        events: [{ startMin: 18 * 60 + 15, endMin: 19 * 60 + 10 }],
      })
    ).toEqual({ startHour: 7, endHour: 20 });
  });
});

describe("minutesOnDate", () => {
  it("reads instants on the Luxembourg wall clock and clips to the day", () => {
    // 2026-11-03 is CET (UTC+1).
    expect(
      minutesOnDate({ start_time: "2026-11-03T09:00:00Z", end_time: "2026-11-03T10:30:00Z" }, "2026-11-03")
    ).toEqual({ startMin: 600, endMin: 690 });
    expect(
      minutesOnDate({ start_time: "2026-11-02T22:00:00Z", end_time: "2026-11-03T08:00:00Z" }, "2026-11-03")
    ).toEqual({ startMin: 0, endMin: 540 });
  });
});

describe("layoutDayEvents", () => {
  const event = (id: string, startMin: number, endMin: number) => ({ id, startMin, endMin });
  const byId = (events: ReturnType<typeof layoutDayEvents<{ id: string; startMin: number; endMin: number }>>) =>
    Object.fromEntries(events.map((e) => [e.id, [e.column, e.columns]]));

  it("gives a lone event the full width", () => {
    expect(byId(layoutDayEvents([event("a", 600, 660)]))).toEqual({ a: [0, 1] });
  });

  it("puts overlapping jobs side by side", () => {
    expect(byId(layoutDayEvents([event("a", 600, 720), event("b", 630, 690)]))).toEqual({
      a: [0, 2],
      b: [1, 2],
    });
  });

  it("treats back-to-back jobs as not overlapping", () => {
    expect(byId(layoutDayEvents([event("a", 600, 660), event("b", 660, 720)]))).toEqual({
      a: [0, 1],
      b: [0, 1],
    });
  });

  it("reuses a freed column inside a cluster and shares the cluster's width", () => {
    // a spans the morning; b and c run one after the other beside it.
    expect(
      byId(layoutDayEvents([event("a", 480, 720), event("b", 480, 540), event("c", 600, 660)]))
    ).toEqual({ a: [0, 2], b: [1, 2], c: [1, 2] });
  });

  it("starts a fresh cluster after a gap", () => {
    expect(
      byId(layoutDayEvents([event("a", 480, 540), event("b", 500, 560), event("c", 600, 660)]))
    ).toEqual({ a: [0, 2], b: [1, 2], c: [0, 1] });
  });
});

describe("closedIntervals", () => {
  it("shades before, between and after opening windows", () => {
    expect(
      closedIntervals({
        windows: [
          { start_time: "08:00:00", end_time: "12:00:00" },
          { start_time: "13:00:00", end_time: "17:00:00" },
        ],
        rangeStartMin: 7 * 60,
        rangeEndMin: 18 * 60,
      })
    ).toEqual([
      { start: 420, end: 480 },
      { start: 720, end: 780 },
      { start: 1020, end: 1080 },
    ]);
  });

  it("shades the whole range on a closed day", () => {
    expect(closedIntervals({ windows: [], rangeStartMin: 480, rangeEndMin: 1080 })).toEqual([
      { start: 480, end: 1080 },
    ]);
  });
});

describe("groupByMechanic", () => {
  const job = (id: string, mechanic: string | null) => ({ id, assigned_mechanic_id: mechanic });

  it("groups by mechanic in the given order and keeps empty columns", () => {
    const { byMechanic, unassigned } = groupByMechanic(
      [job("a", "m2"), job("b", "m1"), job("c", "m2")],
      ["m1", "m2", "m3"]
    );
    expect([...byMechanic.keys()]).toEqual(["m1", "m2", "m3"]);
    expect(byMechanic.get("m2")?.map((item) => item.id)).toEqual(["a", "c"]);
    expect(byMechanic.get("m3")).toEqual([]);
    expect(unassigned).toEqual([]);
  });

  it("collects unassigned jobs and jobs held by someone no longer on the team", () => {
    const { unassigned } = groupByMechanic([job("a", null), job("b", "left-the-team"), job("c", "m1")], ["m1"]);
    expect(unassigned.map((item) => item.id)).toEqual(["a", "b"]);
  });
});

describe("parseDayLayout", () => {
  it("defaults to per-mechanic columns from two mechanics up", () => {
    expect(parseDayLayout(undefined, 1)).toBe("together");
    expect(parseDayLayout(undefined, 2)).toBe("mechanic");
  });

  it("honours an explicit choice, except with no mechanics at all", () => {
    expect(parseDayLayout("together", 3)).toBe("together");
    expect(parseDayLayout("mechanic", 1)).toBe("mechanic");
    expect(parseDayLayout("mechanic", 0)).toBe("together");
  });
});

describe("dropStartMinutes", () => {
  const base = { rangeStartMin: 8 * 60, hourPx: 64, durationMin: 60 };

  it("converts the block's top edge to minutes from the grid's first hour", () => {
    // 128px below an 08:00 start at 64px/hour = 10:00.
    expect(dropStartMinutes({ ...base, blockTopPx: 128 })).toBe(600);
  });

  it("snaps to the nearest quarter hour", () => {
    // 10:07 -> 10:00, 10:08 -> 10:15
    expect(dropStartMinutes({ ...base, blockTopPx: 128 + (7 / 60) * 64 })).toBe(600);
    expect(dropStartMinutes({ ...base, blockTopPx: 128 + (8 / 60) * 64 })).toBe(615);
  });

  it("keeps the whole job inside the day", () => {
    expect(dropStartMinutes({ ...base, rangeStartMin: 0, blockTopPx: -40 })).toBe(0);
    expect(dropStartMinutes({ ...base, rangeStartMin: 0, blockTopPx: 24 * 64 })).toBe(23 * 60);
  });

  it("formats minutes as HH:MM", () => {
    expect(minutesToTime(615)).toBe("10:15");
    expect(minutesToTime(0)).toBe("00:00");
  });
});

describe("resizeEndMinutes", () => {
  const base = { rangeStartMin: 8 * 60, hourPx: 64, startMin: 10 * 60 };

  it("converts the bottom edge to an end time, snapped to 15 minutes", () => {
    // 11:30 is 3.5 hours below 08:00 = 224px; 11:37 still snaps to 11:30.
    expect(resizeEndMinutes({ ...base, blockBottomPx: 224 })).toBe(690);
    expect(resizeEndMinutes({ ...base, blockBottomPx: 224 + (7 / 60) * 64 })).toBe(690);
  });

  it("never makes a job shorter than the minimum", () => {
    expect(resizeEndMinutes({ ...base, blockBottomPx: 0 })).toBe(600 + MIN_JOB_MINUTES);
  });

  it("never runs past midnight", () => {
    expect(resizeEndMinutes({ ...base, blockBottomPx: 20 * 64 })).toBe(24 * 60);
  });
});
