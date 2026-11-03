import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import en from "@/lib/i18n/dictionaries/en.json";
import type { DaySchedule } from "@/lib/availability";
import { AppointmentList, MonthGrid, TimeGrid, type CalendarAppointment } from "./calendar-views";

const d = en.garageCalendar;
const DAY = "2026-11-04"; // Wednesday, CET (UTC+1)

function appointment(
  id: string,
  startUtc: string,
  endUtc: string,
  overrides: Partial<CalendarAppointment> = {}
): CalendarAppointment {
  return {
    id,
    start_time: startUtc,
    end_time: endUtc,
    status: "confirmed",
    repair_stage: null,
    assigned_mechanic_id: null,
    services: { name: "Oil change" },
    profiles: { full_name: "Ana Costa" },
    walk_in: null,
    vehicle: { license_plate: "LU-1234", model: "Golf", brands: { name: "Volkswagen" } },
    ...overrides,
  };
}

const schedule = new Map<string, DaySchedule>([
  [
    DAY,
    {
      windows: [
        { start_time: "08:00:00", end_time: "12:00:00" },
        { start_time: "13:00:00", end_time: "17:00:00" },
      ],
      isClosed: false,
      blocks: [
        { id: "b1", start: new Date("2026-11-04T14:00:00Z"), end: new Date("2026-11-04T15:00:00Z"), reason: "Staff meeting" },
      ],
    },
  ],
]);

function renderDay(appointments: CalendarAppointment[]) {
  return renderToStaticMarkup(
    <TimeGrid
      dates={[DAY]}
      appointments={appointments}
      schedule={schedule}
      startHour={8}
      endHour={18}
      todayKey="2026-11-01"
      now={new Date("2026-11-01T08:00:00Z")}
      lang="en"
      dateLocale="en-GB"
      d={d}
      hrefForAppointment={(id) => `/en/garage/calendar?appt=${id}`}
      hrefForDay={null}
      selectedId={null}
    />
  );
}

describe("TimeGrid", () => {
  it("positions an appointment by its Luxembourg wall-clock time (64px per hour from 08:00)", () => {
    // 09:00Z-10:30Z = 10:00-11:30 CET -> top 128px (+1 inset), height 96px (-2 inset).
    const html = renderDay([appointment("a", "2026-11-04T09:00:00Z", "2026-11-04T10:30:00Z")]);
    expect(html).toContain("top:129px");
    expect(html).toContain("height:94px");
    expect(html).toContain("10:00–11:30");
    expect(html).toContain("Ana Costa");
    expect(html).toContain("LU-1234");
    expect(html).toContain("Oil change");
  });

  it("puts overlapping jobs side by side at half width", () => {
    const html = renderDay([
      appointment("a", "2026-11-04T09:00:00Z", "2026-11-04T10:00:00Z"),
      appointment("b", "2026-11-04T09:30:00Z", "2026-11-04T10:30:00Z"),
    ]);
    expect(html).toContain("left:calc(0% + 2px);width:calc(50% - 4px)");
    expect(html).toContain("left:calc(50% + 2px);width:calc(50% - 4px)");
  });

  it("offers one bookable button per future half-hour and labels the block", () => {
    const html = renderDay([]);
    // 08:00-18:00 = 20 half-hours, all in the future relative to `now`.
    expect(html.match(/data-slot-date="2026-11-04"/g)).toHaveLength(20);
    expect(html).toContain('data-slot-time="10:00"');
    expect(html).toContain("New appointment, Wed 4 Nov at 10:00");
    expect(html).toContain("Blocked · Staff meeting");
  });

  it("offers no slots on a past day", () => {
    const html = renderToStaticMarkup(
      <TimeGrid
        dates={[DAY]}
        appointments={[]}
        schedule={schedule}
        startHour={8}
        endHour={18}
        todayKey="2026-11-10"
        now={new Date("2026-11-10T08:00:00Z")}
        lang="en"
        dateLocale="en-GB"
        d={d}
        hrefForAppointment={(id) => id}
        hrefForDay={null}
        selectedId={null}
      />
    );
    expect(html).not.toContain("data-slot-date");
  });
});

describe("MonthGrid and AppointmentList", () => {
  it("lists a day's appointments with an overflow link", () => {
    const many = ["a", "b", "c", "d"].map((id, index) =>
      appointment(
        id,
        `2026-11-04T${String(8 + index).padStart(2, "0")}:00:00Z`,
        `2026-11-04T${String(8 + index).padStart(2, "0")}:30:00Z`
      )
    );
    const html = renderToStaticMarkup(
      <MonthGrid
        dates={Array.from({ length: 42 }, (_, i) => `2026-11-${String(i + 1).padStart(2, "0")}`).slice(0, 30)}
        monthKey="2026-11"
        appointments={many}
        todayKey="2026-11-03"
        lang="en"
        dateLocale="en-GB"
        d={d}
        hrefForAppointment={(id) => id}
        hrefForDay={(date) => date}
      />
    );
    expect(html).toContain("+1 more");
  });

  it("shows cancelled jobs in the list with their status", () => {
    const html = renderToStaticMarkup(
      <AppointmentList
        dates={[DAY]}
        appointments={[appointment("a", "2026-11-04T09:00:00Z", "2026-11-04T10:00:00Z", { status: "cancelled" })]}
        mechanicNames={new Map()}
        todayKey="2026-11-03"
        lang="en"
        dateLocale="en-GB"
        d={d}
        statusLabels={en.common.appointmentStatus}
        hrefForAppointment={(id) => id}
      />
    );
    expect(html).toContain("Cancelled");
    expect(html).toContain("line-through");
  });
});
