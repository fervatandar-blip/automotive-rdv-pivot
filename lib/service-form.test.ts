import { describe, expect, it } from "vitest";
import { ServiceFormSchema } from "@/lib/definitions";

describe("ServiceFormSchema", () => {
  const base = { name: "Vidange", durationMinutes: "45", category: "maintenance" };

  it("accepts a service with no price at all (0050)", () => {
    const result = ServiceFormSchema.safeParse(base);
    expect(result.success).toBe(true);
    expect(result.success && "price" in result.data).toBe(false);
  });

  it("ignores price fields a stale form might still post", () => {
    const result = ServiceFormSchema.safeParse({ ...base, pricingType: "fixed", price: "89" });
    expect(result.success).toBe(true);
    expect(result.success && "price" in result.data).toBe(false);
    expect(result.success && "pricingType" in result.data).toBe(false);
  });

  it("still requires a positive duration and a known category", () => {
    expect(ServiceFormSchema.safeParse({ ...base, durationMinutes: "0" }).success).toBe(false);
    expect(ServiceFormSchema.safeParse({ ...base, category: "tuning" }).success).toBe(false);
  });
});
