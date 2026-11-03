import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import en from "@/lib/i18n/dictionaries/en.json";
import { weekFormFromWindows } from "@/lib/opening-hours";
import { WeeklyHoursForm } from "./weekly-hours-form";

function render(windows: Parameters<typeof weekFormFromWindows>[0]) {
  return renderToStaticMarkup(
    <WeeklyHoursForm lang="en" d={en.garageAvailability} initialDays={weekFormFromWindows(windows)} />
  );
}

describe("WeeklyHoursForm", () => {
  it("lists the week Monday first with a switch per day", () => {
    const html = render([]);
    const order = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) =>
      html.indexOf(`>${day}<`)
    );
    expect(order.every((position, index) => position > -1 && (index === 0 || position > order[index - 1]))).toBe(true);
    expect(html.match(/role="switch"/g)).toHaveLength(7);
    expect(html.match(/aria-checked="false"/g)).toHaveLength(7);
  });

  it("shows hours for open days and lunch-break times only where there's a break", () => {
    const html = render([
      { day_of_week: 1, start_time: "08:00:00", end_time: "12:00:00" },
      { day_of_week: 1, start_time: "13:30:00", end_time: "18:00:00" },
      { day_of_week: 2, start_time: "09:00:00", end_time: "17:00:00" },
    ]);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(2);
    expect(html).toContain('aria-label="Monday lunch break start"');
    expect(html).toContain('value="13:30"');
    expect(html).not.toContain('aria-label="Tuesday lunch break start"');
    expect(html).toContain('aria-label="Tuesday opening time"');
  });

  it("warns about days with more ranges than the form shows", () => {
    const html = render([
      { day_of_week: 3, start_time: "07:00", end_time: "09:00" },
      { day_of_week: 3, start_time: "10:00", end_time: "12:00" },
      { day_of_week: 3, start_time: "14:00", end_time: "18:00" },
    ]);
    expect(html).toContain("more than two time ranges");
  });

  it("disables Save until something changes", () => {
    expect(render([])).toMatch(/<button type="submit" disabled=""[^>]*>Save hours<\/button>/);
  });
});
