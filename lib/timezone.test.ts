import { describe, expect, it } from "vitest";
import {
  addDaysToDateKey,
  APP_TIME_ZONE,
  dateKeyInAppZone,
  dateKeyToDisplayDate,
  dayOfWeekForDateKey,
  todayKeyInAppZone,
  zonedDateTimeToUtc,
  zonedStartOfDay,
} from "./timezone";

// Runs with TZ=UTC (vitest.config.ts), like Vercel. Nothing here may depend
// on the process zone.

describe("zonedDateTimeToUtc", () => {
  it("converts summer wall-clock time (CEST, UTC+2)", () => {
    expect(zonedDateTimeToUtc("2026-06-01", "09:00").toISOString()).toBe(
      "2026-06-01T07:00:00.000Z"
    );
  });

  it("converts winter wall-clock time (CET, UTC+1)", () => {
    expect(zonedDateTimeToUtc("2026-01-15", "09:00").toISOString()).toBe(
      "2026-01-15T08:00:00.000Z"
    );
  });

  it("accepts HH:MM:SS as well as HH:MM", () => {
    expect(zonedDateTimeToUtc("2026-06-01", "09:30:15").toISOString()).toBe(
      "2026-06-01T07:30:15.000Z"
    );
  });

  it("uses the new offset right after the spring-forward transition", () => {
    // 2026-03-29: clocks jump 02:00 CET -> 03:00 CEST.
    expect(zonedDateTimeToUtc("2026-03-29", "01:30").toISOString()).toBe(
      "2026-03-29T00:30:00.000Z"
    );
    expect(zonedDateTimeToUtc("2026-03-29", "09:00").toISOString()).toBe(
      "2026-03-29T07:00:00.000Z"
    );
  });

  it("uses the new offset right after the fall-back transition", () => {
    // 2026-10-25: clocks go 03:00 CEST -> 02:00 CET.
    expect(zonedDateTimeToUtc("2026-10-25", "09:00").toISOString()).toBe(
      "2026-10-25T08:00:00.000Z"
    );
    expect(zonedDateTimeToUtc("2026-10-24", "09:00").toISOString()).toBe(
      "2026-10-24T07:00:00.000Z"
    );
  });

  it("round-trips every half hour of a DST-change day through the zone formatter", () => {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: APP_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    // Skip the nonexistent 02:00-03:00 gap on spring-forward day.
    for (let minutes = 0; minutes < 24 * 60; minutes += 30) {
      if (minutes >= 120 && minutes < 180) continue;
      const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mm = String(minutes % 60).padStart(2, "0");
      const instant = zonedDateTimeToUtc("2026-03-29", `${hh}:${mm}`);
      expect(formatter.format(instant)).toBe(`${hh}:${mm}`);
      expect(dateKeyInAppZone(instant)).toBe("2026-03-29");
    }
  });
});

describe("zonedStartOfDay", () => {
  it("is local midnight, i.e. 22:00Z the previous day in summer", () => {
    expect(zonedStartOfDay("2026-06-01").toISOString()).toBe(
      "2026-05-31T22:00:00.000Z"
    );
  });

  it("is 23:00Z the previous day in winter", () => {
    expect(zonedStartOfDay("2026-01-15").toISOString()).toBe(
      "2026-01-14T23:00:00.000Z"
    );
  });
});

describe("dateKeyInAppZone / todayKeyInAppZone", () => {
  it("rolls over at local midnight, not UTC midnight", () => {
    // 22:30Z on 31 May is already 00:30 on 1 June in Luxembourg.
    expect(dateKeyInAppZone(new Date("2026-05-31T22:30:00Z"))).toBe("2026-06-01");
    expect(dateKeyInAppZone(new Date("2026-05-31T21:30:00Z"))).toBe("2026-05-31");
  });

  it("todayKeyInAppZone honours an injected clock", () => {
    expect(todayKeyInAppZone(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});

describe("date-key arithmetic", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDaysToDateKey("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDaysToDateKey("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDaysToDateKey("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("adds days across a DST transition without drifting", () => {
    expect(addDaysToDateKey("2026-03-28", 1)).toBe("2026-03-29");
    expect(addDaysToDateKey("2026-03-28", 2)).toBe("2026-03-30");
  });

  it("returns the weekday for a date key (0 = Sunday)", () => {
    expect(dayOfWeekForDateKey("2026-06-01")).toBe(1); // Monday
    expect(dayOfWeekForDateKey("2026-06-07")).toBe(0); // Sunday
  });
});

describe("dateKeyToDisplayDate", () => {
  it("formats back to the same calendar date in the app zone", () => {
    const formatted = dateKeyToDisplayDate("2026-06-01").toLocaleDateString("en-CA", {
      timeZone: APP_TIME_ZONE,
    });
    expect(formatted).toBe("2026-06-01");
  });
});
