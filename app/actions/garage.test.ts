import { beforeEach, describe, expect, it, vi } from "vitest";

class RedirectSignal extends Error {
  constructor(public url: string) {
    super(`REDIRECT:${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: vi.fn((url: string) => {
    throw new RedirectSignal(url);
  }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

type Garage = {
  id: string;
  status: string;
  country: string;
  registration_number: string | null;
  platform_terms_accepted_at: string | null;
  address: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
};
let garage: Garage;
vi.mock("@/lib/dal", () => ({
  requireGarageOwner: vi.fn(() => Promise.resolve({ garage, profile: { id: "owner" }, isOwner: true })),
}));

type Op = { table: string; method: string; args: unknown[] };
let ops: Op[];
let availabilityCount: number;

function makeBuilder(table: string) {
  let operation = "select";
  const builder: Record<string, unknown> = {};
  for (const method of ["insert", "update", "delete", "select", "eq"]) {
    builder[method] = (...args: unknown[]) => {
      ops.push({ table, method, args });
      if (method !== "eq" && method !== "select") operation = method;
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => unknown) =>
    Promise.resolve(
      table === "availability" && operation === "select"
        ? { count: availabilityCount, error: null }
        : { data: null, error: null }
    ).then(resolve);
  return builder;
}

// Real shouldGeocode, stubbed network call.
const geocodeAddress = vi.fn(async (): Promise<{ latitude: number; longitude: number } | null> => null);
vi.mock("@/lib/geocode", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/geocode")>()),
  geocodeAddress: (...args: unknown[]) => geocodeAddress(...(args as [])),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(() => Promise.resolve({ from: (table: string) => makeBuilder(table) })),
}));

const { completeOnboarding, updateGarageProfile } = await import("./garage");

function form(fields: Record<string, string | string[]>) {
  const formData = new FormData();
  formData.set("lang", "en");
  for (const [key, value] of Object.entries(fields)) {
    for (const item of Array.isArray(value) ? value : [value]) formData.append(key, item);
  }
  return formData;
}

async function redirectedTo(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    if (error instanceof RedirectSignal) return error.url;
    throw error;
  }
  throw new Error("expected a redirect");
}

function garageUpdate() {
  return ops.find((op) => op.table === "garages" && op.method === "update")?.args[0] as
    | Record<string, unknown>
    | undefined;
}

const VALID_LU_RCS = "B123456";

beforeEach(() => {
  ops = [];
  availabilityCount = 0;
  garage = {
    id: "garage-1",
    status: "approved",
    country: "LU",
    registration_number: VALID_LU_RCS,
    platform_terms_accepted_at: "2026-01-01T00:00:00Z",
    address: "12 Rue de Hollerich",
    city: "Luxembourg",
    latitude: 49.6,
    longitude: 6.1,
  };
  geocodeAddress.mockReset();
  geocodeAddress.mockResolvedValue(null);
});

describe("updateGarageProfile: details section", () => {
  it("never writes country or registration number for an approved garage, even if posted", async () => {
    const result = await updateGarageProfile(
      undefined,
      form({ section: "details", name: "Garage Renamed", country: "FR", registrationNumber: "123456789" })
    );

    expect(result?.savedAt).toBeTypeOf("number");
    const update = garageUpdate();
    expect(update?.name).toBe("Garage Renamed");
    expect(update).not.toHaveProperty("country");
    expect(update).not.toHaveProperty("registration_number");
  });

  it("lets a not-yet-approved garage correct its legal identity", async () => {
    garage.status = "pending";

    await updateGarageProfile(
      undefined,
      form({ section: "details", name: "Garage", country: "LU", registrationNumber: "B654321" })
    );

    expect(garageUpdate()).toMatchObject({ country: "LU", registration_number: "B654321" });
  });

  it("rejects a non-http(s) website before touching the database", async () => {
    const result = await updateGarageProfile(
      undefined,
      form({ section: "details", name: "Garage", website: "javascript:alert(1)" })
    );

    expect(result?.errors?.website).toBeDefined();
    expect(garageUpdate()).toBeUndefined();
  });

  it("only writes the details section's own columns", async () => {
    await updateGarageProfile(undefined, form({ section: "details", name: "Garage", evCapable: "on" }));

    const update = garageUpdate();
    expect(update).not.toHaveProperty("ev_capable");
    expect(update).not.toHaveProperty("latitude");
    expect(update).not.toHaveProperty("address");
    expect(update).not.toHaveProperty("status");
  });
});

describe("updateGarageProfile: other sections", () => {
  it("keeps only known languages in the capabilities section", async () => {
    await updateGarageProfile(
      undefined,
      form({ section: "capabilities", languages: ["French", "Klingon", "German"], evCapable: "on" })
    );

    expect(garageUpdate()).toMatchObject({
      languages_spoken: ["French", "German"],
      ev_capable: true,
      mobile_service: false,
    });
  });

  it("clears a half-set or out-of-range map pin instead of saving it", async () => {
    await updateGarageProfile(undefined, form({ section: "location", latitude: "49.6", longitude: "" }));
    expect(garageUpdate()).toMatchObject({ latitude: null, longitude: null });

    ops = [];
    await updateGarageProfile(undefined, form({ section: "location", latitude: "999", longitude: "6.1" }));
    expect(garageUpdate()).toMatchObject({ latitude: null, longitude: null });
  });

  it("saves the street address and city with the map pin", async () => {
    await updateGarageProfile(
      undefined,
      form({ section: "location", address: " 12 Rue de Hollerich ", city: "Luxembourg", latitude: "49.6", longitude: "6.1" })
    );
    expect(garageUpdate()).toEqual({
      address: "12 Rue de Hollerich",
      city: "Luxembourg",
      latitude: 49.6,
      longitude: 6.1,
    });
  });

  it("geocodes a changed address when the pin wasn't moved", async () => {
    geocodeAddress.mockResolvedValue({ latitude: 49.4958, longitude: 5.9806 });
    await updateGarageProfile(
      undefined,
      form({ section: "location", address: "1 Rue de l'Alzette", city: "Esch-sur-Alzette", latitude: "49.6", longitude: "6.1" })
    );
    expect(geocodeAddress).toHaveBeenCalledWith({ address: "1 Rue de l'Alzette", city: "Esch-sur-Alzette", country: "LU" });
    expect(garageUpdate()).toMatchObject({ latitude: 49.4958, longitude: 5.9806 });
  });

  it("keeps a hand-placed pin and the old pin when geocoding fails", async () => {
    await updateGarageProfile(
      undefined,
      form({ section: "location", address: "1 Rue de l'Alzette", city: "Esch-sur-Alzette", latitude: "49.5", longitude: "5.98" })
    );
    expect(geocodeAddress).not.toHaveBeenCalled();
    expect(garageUpdate()).toMatchObject({ latitude: 49.5, longitude: 5.98 });

    ops = [];
    await updateGarageProfile(
      undefined,
      form({ section: "location", address: "Nowhere 1", city: "Luxembourg", latitude: "49.6", longitude: "6.1" })
    );
    expect(geocodeAddress).toHaveBeenCalledTimes(1);
    expect(garageUpdate()).toMatchObject({ latitude: 49.6, longitude: 6.1 });
  });

  it("no longer edits brands/specialties from the profile page", async () => {
    const brand = "11111111-1111-4111-8111-111111111111";
    const result = await updateGarageProfile(undefined, form({ section: "catalog", brandIds: [brand] }));
    expect(result?.message).toMatch(/unknown/i);
    expect(ops).toHaveLength(0);
  });

  it("refuses an unknown section", async () => {
    const result = await updateGarageProfile(undefined, form({ section: "status" }));
    expect(result?.message).toMatch(/unknown/i);
    expect(ops).toHaveLength(0);
  });

  it("sends a garage that hasn't finished setup back to the wizard", async () => {
    garage.platform_terms_accepted_at = null;
    expect(await redirectedTo(updateGarageProfile(undefined, form({ section: "details" })))).toBe(
      "/en/garage/onboarding"
    );
  });
});

describe("completeOnboarding", () => {
  beforeEach(() => {
    garage.status = "pending";
    garage.platform_terms_accepted_at = null;
  });

  const wizardFields = {
    name: "New Garage",
    country: "LU",
    platformTermsAccepted: "on",
    hours_0_closed: "on",
    hours_1_open: "08:00",
    hours_1_close: "17:00",
    hours_2_open: "18:00",
    hours_2_close: "09:00", // inverted -> ignored
  };

  it("seeds the availability schedule from the hours step when the garage has none", async () => {
    await redirectedTo(completeOnboarding(undefined, form(wizardFields)));

    const insert = ops.find((op) => op.table === "availability" && op.method === "insert");
    const windows = insert?.args[0] as { day_of_week: number }[];
    expect(windows).toContainEqual({
      garage_id: "garage-1",
      day_of_week: 1,
      start_time: "08:00",
      end_time: "17:00",
    });
    expect(windows.some((window) => window.day_of_week === 0)).toBe(false);
    expect(windows.some((window) => window.day_of_week === 2)).toBe(false);
  });

  it("never overwrites an existing availability schedule", async () => {
    availabilityCount = 3;
    await redirectedTo(completeOnboarding(undefined, form(wizardFields)));

    expect(ops.some((op) => op.table === "availability" && op.method === "insert")).toBe(false);
  });

  it("no longer collects brands or specialties, even if posted", async () => {
    const brand = "11111111-1111-4111-8111-111111111111";
    await redirectedTo(completeOnboarding(undefined, form({ ...wizardFields, brandIds: [brand], specialtyIds: [brand] })));
    expect(ops.some((op) => op.table === "garage_brands" || op.table === "garage_specialties")).toBe(false);
  });

  it("no longer writes the unused opening_hours column", async () => {
    await redirectedTo(completeOnboarding(undefined, form(wizardFields)));
    expect(garageUpdate()).not.toHaveProperty("opening_hours");
  });

  it("is first-run only: an onboarded garage is sent to the profile editor", async () => {
    garage.platform_terms_accepted_at = "2026-01-01T00:00:00Z";
    expect(await redirectedTo(completeOnboarding(undefined, form(wizardFields)))).toBe(
      "/en/garage/profile"
    );
    expect(ops).toHaveLength(0);
  });
});
