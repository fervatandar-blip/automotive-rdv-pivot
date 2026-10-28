import { describe, expect, it } from "vitest";
import { hasAnyOpeningHours, summarizeWeeklyHours } from "./opening-hours";

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
