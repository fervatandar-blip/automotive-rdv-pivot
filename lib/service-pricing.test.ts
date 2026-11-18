import { describe, expect, it } from "vitest";
import { ServiceFormSchema } from "@/lib/definitions";
import { formatServicePrice, isInvoiceablePrice } from "@/lib/service-pricing";

const labels = { priceFrom: "From {price}", priceOnInspection: "Price on inspection" };
// Intl puts a no-break space before the euro sign.
const normalize = (text: string) => text.replace(/\s/g, " ");

describe("formatServicePrice", () => {
  it("shows a fixed price as the amount", () => {
    expect(normalize(formatServicePrice({ pricing_type: "fixed", price: 89 }, labels))).toBe("89,00 €");
  });

  it("prefixes a starting price", () => {
    expect(normalize(formatServicePrice({ pricing_type: "from", price: "89.00" }, labels))).toBe("From 89,00 €");
  });

  it("shows no amount for on-inspection, or for a row missing its price", () => {
    expect(formatServicePrice({ pricing_type: "on_inspection", price: null }, labels)).toBe("Price on inspection");
    expect(formatServicePrice({ pricing_type: "fixed", price: null }, labels)).toBe("Price on inspection");
  });

  it("treats an unknown pricing type as fixed", () => {
    expect(normalize(formatServicePrice({ pricing_type: null, price: 10 }, labels))).toBe("10,00 €");
  });
});

describe("isInvoiceablePrice", () => {
  it("only invoices fixed prices automatically", () => {
    expect(isInvoiceablePrice({ pricing_type: "fixed", price: 89 })).toBe(true);
    expect(isInvoiceablePrice({ pricing_type: "from", price: 89 })).toBe(false);
    expect(isInvoiceablePrice({ pricing_type: "on_inspection", price: null })).toBe(false);
  });
});

describe("ServiceFormSchema pricing", () => {
  const base = { name: "Oil change", durationMinutes: "60" };

  it("requires a price for fixed and starting prices instead of saving 0", () => {
    const fixed = ServiceFormSchema.safeParse({ ...base, pricingType: "fixed", price: "" });
    expect(fixed.success).toBe(false);
    expect(fixed.error?.flatten().fieldErrors.price).toBeDefined();

    const from = ServiceFormSchema.safeParse({ ...base, pricingType: "from" });
    expect(from.success).toBe(false);
  });

  it("drops any posted amount for on-inspection", () => {
    const result = ServiceFormSchema.safeParse({ ...base, pricingType: "on_inspection", price: "50" });
    expect(result.success && result.data.price).toBeNull();
  });

  it("accepts a comma decimal and rounds to cents", () => {
    const result = ServiceFormSchema.safeParse({ ...base, pricingType: "from", price: "89,999" });
    expect(result.success && result.data.price).toBe(90);
  });

  it("rejects negative or unknown values", () => {
    expect(ServiceFormSchema.safeParse({ ...base, pricingType: "fixed", price: "-5" }).success).toBe(false);
    expect(ServiceFormSchema.safeParse({ ...base, pricingType: "free", price: "5" }).success).toBe(false);
  });
});
