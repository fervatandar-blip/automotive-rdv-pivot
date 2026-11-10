import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import en from "@/lib/i18n/dictionaries/en.json";
import type { DaySchedule } from "@/lib/availability";
import {
  AppointmentList,
  MonthGrid,
  TimeGrid,
  type CalendarAppointment,
  type GridColumn,
} from "./calendar-views";

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

function dayColumn(appointments: CalendarAppointment[]): GridColumn[] {
  return [{ key: DAY, date: DAY, appointments, header: { kind: "date", href: null } }];
}

function renderColumns(columns: GridColumn[]) {
  return renderToStaticMarkup(
    <TimeGrid
      columns={columns}
      schedule={schedule}
      startHour={8}
      endHour={18}
      todayKey="2026-11-01"
      now={new Date("2026-11-01T08:00:00Z")}
      lang="en"
      dateLocale="en-GB"
      d={d}
      hrefForAppointment={(id) => `/en/garage/calendar?appt=${id}`}
      selectedId={null}
    />
  );
}

const renderDay = (appointments: CalendarAppointment[]) => renderColumns(dayColumn(appointments));

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
        columns={dayColumn([])}
        schedule={schedule}
        startHour={8}
        endHour={18}
        todayKey="2026-11-10"
        now={new Date("2026-11-10T08:00:00Z")}
        lang="en"
        dateLocale="en-GB"
        d={d}
        hrefForAppointment={(id) => id}
        selectedId={null}
      />
    );
    expect(html).not.toContain("data-slot-date");
  });
});

describe("TimeGrid drag metadata", () => {
  it("makes open jobs draggable and leaves finished ones alone", () => {
    const html = renderDay([
      appointment("open", "2026-11-04T09:00:00Z", "2026-11-04T10:30:00Z"),
      appointment("done", "2026-11-04T12:00:00Z", "2026-11-04T13:00:00Z", { status: "completed" }),
    ]);
    expect(html).toContain('data-drag-appt="open"');
    expect(html).toContain('data-drag-duration="90"');
    expect(html).toContain('data-drag-notify="1"');
    expect(html).not.toContain('data-drag-appt="done"');
    expect(html).toContain("data-grid-scroll");
    expect(html).toContain('data-range-start="480"');
    // Exact start on this day: 09:00Z = 10:00 CET = 600 minutes.
    expect(html).toContain('data-drag-start="600"');
  });

  it("gives whole same-day open jobs a resize handle, not overnight or finished ones", () => {
    const sameDay = renderDay([appointment("open", "2026-11-04T09:00:00Z", "2026-11-04T10:30:00Z")]);
    expect(sameDay.match(/data-resize-handle/g)).toHaveLength(1);
    expect(sameDay).toContain("Drag to change the length");

    const overnight = renderDay([appointment("night", "2026-11-03T20:00:00Z", "2026-11-04T09:00:00Z")]);
    expect(overnight).toContain('data-drag-appt="night"');
    expect(overnight).not.toContain("data-resize-handle");

    const done = renderDay([
      appointment("done", "2026-11-04T09:00:00Z", "2026-11-04T10:00:00Z", { status: "completed" }),
    ]);
    expect(done).not.toContain("data-resize-handle");
  });
});

describe("TimeGrid by mechanic", () => {
  it("renders a column per mechanic whose slots preset that mechanic", () => {
    const html = renderColumns([
      {
        key: "mechanic:m1",
        date: DAY,
        mechanicId: "m1",
        appointments: [appointment("a", "2026-11-04T09:00:00Z", "2026-11-04T10:00:00Z", { assigned_mechanic_id: "m1" })],
        header: { kind: "mechanic", name: "Marc Weber", isYou: true, count: 1 },
      },
      {
        key: "mechanic:m2",
        date: DAY,
        mechanicId: "m2",
        appointments: [],
        header: { kind: "mechanic", name: "Lea Muller", isYou: false, count: 0 },
      },
    ]);
    expect(html).toContain("Marc Weber");
    expect(html).toContain("(you)");
    expect(html).toContain("1 service order(s)");
    expect(html).toContain(">MW<");
    expect(html.match(/data-slot-mechanic="m2"/g)).toHaveLength(20);
    expect(html).toContain('data-col-mechanic="m2" data-col-mechanic-name="Lea Muller"');
    expect(html).toContain("New appointment, Wed 4 Nov at 10:00 with Lea Muller");
    // The job sits only in Marc's column.
    // (Counting the visible name; the hover title repeats it.)
    expect(html.match(/>Ana Costa</g)).toHaveLength(1);
  });

  it("labels the unassigned column and gives its slots no mechanic", () => {
    const html = renderColumns([
      {
        key: "unassigned",
        date: DAY,
        appointments: [appointment("a", "2026-11-04T09:00:00Z", "2026-11-04T10:00:00Z")],
        header: { kind: "unassigned", count: 1 },
      },
    ]);
    expect(html).toContain("Unassigned");
    expect(html).not.toContain("data-slot-mechanic");
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
