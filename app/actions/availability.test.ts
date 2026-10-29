import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/dal", () => ({
  requireGarageMember: vi.fn(() =>
    Promise.resolve({ garage: { id: "garage-1" }, profile: { id: "owner" }, isOwner: true })
  ),
}));

type Window = { day_of_week: number; start_time: string; end_time: string };
let existing: Window[];
let inserted: unknown[] | null;
let insertError: { code: string; message: string } | null;

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      from: () => {
        let days: number[] = [];
        const builder = {
          select: () => builder,
          eq: () => builder,
          in: (_column: string, values: number[]) => {
            days = values;
            return builder;
          },
          insert: (rows: unknown[]) => {
            inserted = rows;
            return Promise.resolve({ error: insertError });
          },
          then: (resolve: (value: unknown) => unknown) =>
            Promise.resolve({
              data: existing.filter((window) => days.includes(window.day_of_week)),
              error: null,
            }).then(resolve),
        };
        return builder;
      },
    })
  ),
}));

const { createAvailability } = await import("./availability");

function form(days: number[], startTime: string, endTime: string) {
  const formData = new FormData();
  formData.set("lang", "en");
  for (const day of days) formData.append("days", String(day));
  formData.set("startTime", startTime);
  formData.set("endTime", endTime);
  return formData;
}

beforeEach(() => {
  existing = [];
  inserted = null;
  insertError = null;
});

describe("createAvailability", () => {
  it("adds one window to every chosen day in a single submission", async () => {
    const result = await createAvailability(undefined, form([1, 2, 3, 4, 5], "08:00", "12:00"));

    expect(result).toEqual({ added: 5 });
    expect(inserted).toHaveLength(5);
    expect(inserted?.[0]).toEqual({
      garage_id: "garage-1",
      day_of_week: 1,
      start_time: "08:00",
      end_time: "12:00",
    });
  });

  it("allows the afternoon half of a split shift next to an existing morning", async () => {
    existing = [{ day_of_week: 1, start_time: "08:00:00", end_time: "12:00:00" }];

    const result = await createAvailability(undefined, form([1], "13:30", "18:00"));

    expect(result).toEqual({ added: 1 });
  });

  it("allows back-to-back windows (end == next start)", async () => {
    existing = [{ day_of_week: 1, start_time: "08:00:00", end_time: "12:00:00" }];

    const result = await createAvailability(undefined, form([1], "12:00", "13:00"));

    expect(result).toEqual({ added: 1 });
  });

  it("adds nothing and names every conflicting day when any chosen day overlaps", async () => {
    existing = [
      { day_of_week: 2, start_time: "08:00:00", end_time: "18:00:00" },
      { day_of_week: 4, start_time: "10:00:00", end_time: "11:00:00" },
    ];

    const result = await createAvailability(undefined, form([1, 2, 3, 4, 5], "08:00", "12:00"));

    expect(result).toEqual({ conflictDays: [2, 4] });
    expect(inserted).toBeNull();
  });

  it("de-duplicates days posted twice", async () => {
    await createAvailability(undefined, form([3, 3], "08:00", "12:00"));
    expect(inserted).toHaveLength(1);
  });

  it("rejects no days, impossible times and inverted windows before touching the DB", async () => {
    expect((await createAvailability(undefined, form([], "08:00", "12:00")))?.errors?.days).toBeDefined();
    expect((await createAvailability(undefined, form([1], "25:00", "26:00")))?.errors?.startTime).toBeDefined();
    expect((await createAvailability(undefined, form([1], "12:00", "08:00")))?.errors?.endTime).toBeDefined();
    expect((await createAvailability(undefined, form([7], "08:00", "12:00")))?.errors?.days).toBeDefined();
    expect(inserted).toBeNull();
  });

  it("maps a race with the overlap constraint (23P01) to a friendly message", async () => {
    insertError = { code: "23P01", message: "conflicting key value violates exclusion constraint" };

    const result = await createAvailability(undefined, form([1], "08:00", "12:00"));

    expect(result?.message).toMatch(/overlaps/i);
    expect(result?.message).not.toMatch(/exclusion constraint/);
  });
});
