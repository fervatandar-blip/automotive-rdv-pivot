import { describe, expect, it } from "vitest";
import { closedDateKeys } from "./closed-days";

// 2026-12-07 is a Monday; 2026-12-13 a Sunday.
const week = ["2026-12-07", "2026-12-08", "2026-12-09", "2026-12-10", "2026-12-11", "2026-12-12", "2026-12-13"];
const monToSat = new Set([1, 2, 3, 4, 5, 6]);

describe("closedDateKeys", () => {
  it("closes weekdays without weekly hours", () => {
    expect([...closedDateKeys({ dateKeys: week, openWeekdays: monToSat, overrides: [] })]).toEqual(["2026-12-13"]);
  });

  it("closes a normally open day with a closed override", () => {
    const closed = closedDateKeys({
      dateKeys: week,
      openWeekdays: monToSat,
      overrides: [{ date: "2026-12-09", is_closed: true }],
    });
    expect(closed.has("2026-12-09")).toBe(true);
  });

  it("opens a normally closed day with special hours", () => {
    const closed = closedDateKeys({
      dateKeys: week,
      openWeekdays: monToSat,
      overrides: [{ date: "2026-12-13", is_closed: false }],
    });
    expect(closed.has("2026-12-13")).toBe(false);
  });

  it("treats every day as closed when no weekly hours exist", () => {
    expect(closedDateKeys({ dateKeys: week, openWeekdays: new Set(), overrides: [] }).size).toBe(7);
  });
});
