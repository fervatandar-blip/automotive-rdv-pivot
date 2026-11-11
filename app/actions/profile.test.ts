import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const updates: { table: string; values: Record<string, unknown>; id: unknown }[] = [];
let updateError: unknown = null;
let user: { id: string } | null = { id: "user-1" };

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() =>
    Promise.resolve({
      auth: { getUser: () => Promise.resolve({ data: { user } }) },
      from(table: string) {
        return {
          update(values: Record<string, unknown>) {
            return {
              eq(_column: string, id: unknown) {
                updates.push({ table, values, id });
                return Promise.resolve({ error: updateError });
              },
            };
          },
        };
      },
    })
  ),
}));

const { updateProfileDetails, updateNotificationPreferences } = await import("./profile");

function form(fields: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

beforeEach(() => {
  updates.length = 0;
  updateError = null;
  user = { id: "user-1" };
});

describe("updateProfileDetails", () => {
  it("saves a trimmed name and phone on the caller's own row only", async () => {
    const result = await updateProfileDetails(undefined, form({ fullName: "  Lea Muller ", phone: " +352 621 123 456 " }));
    expect(result).toEqual({ status: "saved" });
    expect(updates).toEqual([
      { table: "profiles", values: { full_name: "Lea Muller", phone: "+352 621 123 456" }, id: "user-1" },
    ]);
  });

  it("stores an empty phone as null (clearing it)", async () => {
    await updateProfileDetails(undefined, form({ fullName: "Lea Muller", phone: "" }));
    expect(updates[0].values.phone).toBeNull();
  });

  it("rejects an invalid phone or short name without writing", async () => {
    const bad = await updateProfileDetails(undefined, form({ fullName: "L", phone: "call me maybe" }));
    expect(bad?.errors?.fullName).toEqual(["nameTooShort"]);
    expect(bad?.errors?.phone).toEqual(["phoneInvalid"]);
    expect(updates).toHaveLength(0);
  });

  it("never writes columns beyond name and phone (0044 grants)", async () => {
    await updateProfileDetails(undefined, form({ fullName: "Lea Muller", phone: "", email: "x@evil.test" }));
    expect(Object.keys(updates[0].values).sort()).toEqual(["full_name", "phone"]);
  });

  it("reports an error when signed out or the update fails", async () => {
    user = null;
    expect(await updateProfileDetails(undefined, form({ fullName: "Lea Muller", phone: "" }))).toEqual({ status: "error" });
    user = { id: "user-1" };
    updateError = { message: "permission denied" };
    expect(await updateProfileDetails(undefined, form({ fullName: "Lea Muller", phone: "" }))).toEqual({ status: "error" });
  });
});

describe("updateNotificationPreferences", () => {
  it("treats absent checkboxes as off", async () => {
    const result = await updateNotificationPreferences(undefined, form({ repairUpdates: "on" }));
    expect(result).toEqual({ status: "saved" });
    expect(updates[0].values).toEqual({ notify_repair_updates: true, notify_waitlist: false });
  });
});
