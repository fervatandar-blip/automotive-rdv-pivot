import { describe, expect, it } from "vitest";
import { normalizePlate, normalizeVehicleSearch, normalizeVin, VIN_PATTERN } from "./vehicle-identifiers";
import { VehicleFormSchema } from "./definitions";

describe("plate normalization", () => {
  it("matches the DB plate_search column: upper-case, letters and digits only", () => {
    expect(normalizePlate("lu-12 34")).toBe("LU1234");
    expect(normalizePlate("Lu1234")).toBe("LU1234");
    expect(normalizePlate("AB · 123 · CD")).toBe("AB123CD");
  });

  it("normalizes a search term the same way, so 'lu 1234' finds 'LU-1234'", () => {
    expect(normalizeVehicleSearch("lu 1234")).toBe(normalizePlate("LU-1234"));
    expect(normalizeVehicleSearch("  ")).toBe("");
  });
});

describe("VIN", () => {
  it("accepts a valid 17-character VIN and rejects I, O and Q", () => {
    expect(VIN_PATTERN.test("WVWZZZ1KZAW123456")).toBe(true);
    expect(VIN_PATTERN.test("WVWZZZ1KZAW12345O")).toBe(false);
    expect(VIN_PATTERN.test("WVWZZZ1KZAW12345I")).toBe(false);
    expect(VIN_PATTERN.test("WVWZZZ1KZAW12345")).toBe(false);
  });

  it("normalizes pasted VINs (case, spaces, dashes)", () => {
    expect(normalizeVin("wvw zzz-1kz aw123456")).toBe("WVWZZZ1KZAW123456");
  });

  it("the vehicle form stores the normalized VIN and rejects invalid ones", () => {
    expect(VehicleFormSchema.parse({ vin: "wvwzzz1kzaw123456" }).vin).toBe("WVWZZZ1KZAW123456");
    expect(VehicleFormSchema.parse({}).vin).toBeUndefined();
    expect(VehicleFormSchema.safeParse({ vin: "NOT-A-VIN" }).success).toBe(false);
  });
});
