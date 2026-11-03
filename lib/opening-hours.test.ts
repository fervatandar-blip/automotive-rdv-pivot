import { describe, expect, it } from "vitest";
import {
  groupConsecutiveDates,
  hasAnyOpeningHours,
  summarizeWeeklyHours,
  weekFormFromWindows,
  windowsFromWeekForm,
  type DayForm,
} from "./opening-hours";

describe("summarizeWeeklyHours", () => {
  it("lists the week Monday-first with every day present", () => {
    const week = summarizeWeeklyHours([]);
    expect(week.map((day) => day.dayOfWeek)).toEqual([1, 2, 3, 4, 5, 6, 0]);
    expect(week.every((day) => day.ranges.length === 0)).toBe(true);
    expect(hasAnyOpeningHours(week)).toBe(false);
  });

  it("groups split shifts on the same day, sorted by start time, as HH:MM", () => {
    const week = summarizeWeeklyHours([
      { day_of_week: 1, start_time: "13:00:00", end_time: "18:00:00" },
      { day_of_week: 1, start_time: "08:00:00", end_time: "12:00:00" },
      { day_of_week: 6, start_time: "09:00", end_time: "12:30" },
    ]);

    expect(week[0]).toEqual({ dayOfWeek: 1, ranges: ["08:00–12:00", "13:00–18:00"] });
    expect(week[5]).toEqual({ dayOfWeek: 6, ranges: ["09:00–12:30"] });
    expect(week[6]).toEqual({ dayOfWeek: 0, ranges: [] });
    expect(hasAnyOpeningHours(week)).toBe(true);
  });
});

describe("weekFormFromWindows", () => {
  it("reads one window as open hours and two as hours with a lunch break", () => {
    const week = weekFormFromWindows([
      { day_of_week: 1, start_time: "08:00:00", end_time: "12:00:00" },
      { day_of_week: 1, start_time: "13:30:00", end_time: "18:00:00" },
      { day_of_week: 2, start_time: "09:00:00", end_time: "17:00:00" },
    ]);
    expect(week[0]).toMatchObject({ dayOfWeek: 1, open: true, opens: "08:00", closes: "18:00", lunch: true, lunchStart: "12:00", lunchEnd: "13:30", extraRanges: false });
    expect(week[1]).toMatchObject({ dayOfWeek: 2, open: true, opens: "09:00", closes: "17:00", lunch: false });
    // Sunday last, closed, with sensible defaults ready.
    expect(week[6]).toMatchObject({ dayOfWeek: 0, open: false, opens: "08:00", closes: "18:00" });
  });

  it("flags a day with more ranges than the form can show", () => {
    const week = weekFormFromWindows([
      { day_of_week: 3, start_time: "07:00", end_time: "09:00" },
      { day_of_week: 3, start_time: "10:00", end_time: "12:00" },
      { day_of_week: 3, start_time: "14:00", end_time: "18:00" },
    ]);
    expect(week[2]).toMatchObject({ opens: "07:00", closes: "18:00", lunchStart: "09:00", lunchEnd: "10:00", extraRanges: true });
  });
});

describe("windowsFromWeekForm", () => {
  const day = (overrides: Partial<DayForm>): DayForm => ({
    dayOfWeek: 1,
    open: true,
    opens: "08:00",
    closes: "18:00",
    lunch: false,
    lunchStart: "12:00",
    lunchEnd: "13:30",
    extraRanges: false,
    ...overrides,
  });

  it("stores a lunch break as a morning and an afternoon window", () => {
    expect(windowsFromWeekForm([day({ lunch: true })])).toEqual({
      windows: [
        { day_of_week: 1, start_time: "08:00", end_time: "12:00" },
        { day_of_week: 1, start_time: "13:30", end_time: "18:00" },
      ],
      errors: {},
    });
  });

  it("stores nothing for a closed day and one window without a break", () => {
    expect(windowsFromWeekForm([day({ open: false }), day({ dayOfWeek: 2 })]).windows).toEqual([
      { day_of_week: 2, start_time: "08:00", end_time: "18:00" },
    ]);
  });

  it("reports one problem per day and stores none of that day", () => {
    const { windows, errors } = windowsFromWeekForm([
      day({ dayOfWeek: 1, closes: "07:00" }),
      day({ dayOfWeek: 2, lunch: true, lunchStart: "07:00" }),
      day({ dayOfWeek: 3, lunch: true, lunchStart: "13:00", lunchEnd: "12:00" }),
      day({ dayOfWeek: 4, opens: "8h" }),
      day({ dayOfWeek: 5 }),
    ]);
    expect(errors).toEqual({ 1: "closeBeforeOpen", 2: "lunchOutsideHours", 3: "lunchOutsideHours", 4: "invalidTime" });
    expect(windows).toEqual([{ day_of_week: 5, start_time: "08:00", end_time: "18:00" }]);
  });
});

describe("groupConsecutiveDates", () => {
  it("merges runs of consecutive days, across month and year ends", () => {
    expect(groupConsecutiveDates(["2026-12-31", "2026-12-24", "2027-01-01", "2026-12-25", "2027-02-10"])).toEqual([
      { from: "2026-12-24", to: "2026-12-25" },
      { from: "2026-12-31", to: "2027-01-01" },
      { from: "2027-02-10", to: "2027-02-10" },
    ]);
  });
});
