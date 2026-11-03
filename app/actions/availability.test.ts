import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/dal", () => ({
  requireGarageMember: vi.fn(() =>
    Promise.resolve({ garage: { id: "garage-1" }, profile: { id: "owner" }, isOwner: true })
  ),
}));
// Fixed "today" so date checks don't depend on when the suite runs.
vi.mock("@/lib/timezone", async () => {
  const actual = await vi.importActual<typeof import("@/lib/timezone")>("@/lib/timezone");
  return { ...actual, todayKeyInAppZone: () => "2026-11-03" };
});

type Call = { table: string; method: string; args: unknown[] };
const calls: Call[] = [];
const rpcCalls: { name: string; args: Record<string, unknown> }[] = [];
let rpcError: { code: string; message: string } | null;
let upsertError: { message: string } | null;
let overlapCount: number;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      rpc(name: string, args: Record<string, unknown>) {
        rpcCalls.push({ name, args });
        return Promise.resolve({ data: 1, error: rpcError });
      },
      from(table: string) {
        let operation = "select";
        const builder: Record<string, unknown> = {};
        const record = (method: string) => (...args: unknown[]) => {
          calls.push({ table, method, args });
          if (["upsert", "delete"].includes(method)) operation = method;
          return builder;
        };
        for (const method of ["select", "upsert", "delete", "eq", "in", "gte", "lt", "lte"]) {
          builder[method] = record(method);
        }
        builder.then = (resolve: (value: unknown) => unknown) =>
          Promise.resolve(
            operation === "upsert"
              ? { error: upsertError }
              : operation === "select"
                ? { count: overlapCount, error: null }
                : { error: null }
          ).then(resolve);
        return builder;
      },
    })
  ),
}));

const { saveWeeklyHours, addClosedDates, removeClosedDates } = await import("./availability");

type Day = {
  dayOfWeek: number;
  open: boolean;
  opens: string;
  closes: string;
  lunch: boolean;
  lunchStart: string;
  lunchEnd: string;
};

function week(overrides: Partial<Record<number, Partial<Day>>> = {}): Day[] {
  return [1, 2, 3, 4, 5, 6, 0].map((dayOfWeek) => ({
    dayOfWeek,
    open: dayOfWeek >= 1 && dayOfWeek <= 5,
    opens: "08:00",
    closes: "18:00",
    lunch: false,
    lunchStart: "12:00",
    lunchEnd: "13:30",
    ...overrides[dayOfWeek],
  }));
}

function form(fields: Record<string, string>) {
  const data = new FormData();
  data.set("lang", "en");
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  calls.length = 0;
  rpcCalls.length = 0;
  rpcError = null;
  upsertError = null;
  overlapCount = 0;
});

describe("saveWeeklyHours", () => {
  it("saves the whole week in one call, splitting lunch breaks into two windows", async () => {
    const result = await saveWeeklyHours(undefined, form({ week: JSON.stringify(week({ 1: { lunch: true } })) }));
    expect(result).toEqual({ saved: true });
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].name).toBe("set_weekly_availability");
    const windows = rpcCalls[0].args.windows as { day_of_week: number }[];
    // Mon: two windows (lunch), Tue-Fri: one each, weekend closed.
    expect(windows).toHaveLength(6);
    expect(windows.slice(0, 2)).toEqual([
      { day_of_week: 1, start_time: "08:00", end_time: "12:00" },
      { day_of_week: 1, start_time: "13:30", end_time: "18:00" },
    ]);
  });

  it("returns per-day errors and saves nothing when any day is invalid", async () => {
    const result = await saveWeeklyHours(
      undefined,
      form({ week: JSON.stringify(week({ 2: { closes: "07:00" }, 3: { lunch: true, lunchEnd: "19:00" } })) })
    );
    expect(result).toEqual({ dayErrors: { 2: "closeBeforeOpen", 3: "lunchOutsideHours" } });
    expect(rpcCalls).toHaveLength(0);
  });

  it("rejects malformed or incomplete weeks", async () => {
    expect(await saveWeeklyHours(undefined, form({ week: "not json" }))).toEqual({ message: "invalid" });
    expect(await saveWeeklyHours(undefined, form({ week: JSON.stringify(week().slice(0, 6)) }))).toEqual({
      message: "invalid",
    });
    const duplicate = week();
    duplicate[6] = { ...duplicate[6], dayOfWeek: 1 };
    expect(await saveWeeklyHours(undefined, form({ week: JSON.stringify(duplicate) }))).toEqual({
      message: "invalid",
    });
    expect(rpcCalls).toHaveLength(0);
  });

  it("reports a database failure", async () => {
    rpcError = { code: "23P01", message: "overlap" };
    expect(await saveWeeklyHours(undefined, form({ week: JSON.stringify(week()) }))).toEqual({
      message: "saveFailed",
    });
  });
});

describe("addClosedDates", () => {
  it("closes every day of a range and reports bookings that fall in it", async () => {
    overlapCount = 2;
    const result = await addClosedDates(undefined, form({ from: "2026-12-24", to: "2026-12-26" }));
    expect(result).toEqual({ added: { from: "2026-12-24", to: "2026-12-26", days: 3, overlapping: 2 } });
    const upsert = calls.find((call) => call.method === "upsert")!;
    expect((upsert.args[0] as { date: string; is_closed: boolean }[]).map((row) => [row.date, row.is_closed])).toEqual([
      ["2026-12-24", true],
      ["2026-12-25", true],
      ["2026-12-26", true],
    ]);
    expect(upsert.args[1]).toEqual({ onConflict: "garage_id,date" });
  });

  it("treats an empty 'to' as a single day", async () => {
    const result = await addClosedDates(undefined, form({ from: "2026-12-24", to: "" }));
    expect(result?.added).toMatchObject({ from: "2026-12-24", to: "2026-12-24", days: 1 });
  });

  it("refuses past dates, inverted ranges and overly long ones", async () => {
    expect((await addClosedDates(undefined, form({ from: "2026-11-02" })))?.errors).toEqual({ from: ["datePast"] });
    expect((await addClosedDates(undefined, form({ from: "2026-12-24", to: "2026-12-20" })))?.errors).toEqual({
      to: ["toBeforeFrom"],
    });
    expect((await addClosedDates(undefined, form({ from: "2026-12-01", to: "2027-03-15" })))?.errors).toEqual({
      to: ["rangeTooLong"],
    });
    expect(calls.filter((call) => call.method === "upsert")).toHaveLength(0);
  });
});

describe("removeClosedDates", () => {
  it("deletes only closed overrides in the range", async () => {
    await removeClosedDates(form({ from: "2026-12-24", to: "2026-12-26" }));
    const methods = calls.map((call) => [call.method, ...call.args]);
    expect(methods).toEqual([
      ["delete"],
      ["eq", "garage_id", "garage-1"],
      ["eq", "is_closed", true],
      ["gte", "date", "2026-12-24"],
      ["lte", "date", "2026-12-26"],
    ]);
  });
});
