import { describe, expect, it } from "vitest";
import { ServiceFormSchema } from "@/lib/definitions";
import {
  groupServicesByCategory,
  normalizeServiceCategory,
  SERVICE_CATEGORIES,
} from "@/lib/service-categories";
import en from "@/lib/i18n/dictionaries/en.json";
import fr from "@/lib/i18n/dictionaries/fr.json";

describe("groupServicesByCategory", () => {
  it("groups in display order, keeps each group's order and drops empty categories", () => {
    const groups = groupServicesByCategory([
      { id: "a", category: "tires" },
      { id: "b", category: "maintenance" },
      { id: "c", category: "tires" },
      { id: "d", category: "other" },
    ]);
    expect(groups.map((group) => group.category)).toEqual(["maintenance", "tires", "other"]);
    expect(groups[1].services.map((service) => service.id)).toEqual(["a", "c"]);
  });

  it("files an unknown or missing category under other", () => {
    const groups = groupServicesByCategory([
      { id: "a", category: "spaceship" },
      { id: "b", category: null },
      { id: "c" },
    ]);
    expect(groups).toEqual([
      { category: "other", services: [{ id: "a", category: "spaceship" }, { id: "b", category: null }, { id: "c" }] },
    ]);
  });

  it("returns no groups for no services", () => {
    expect(groupServicesByCategory([])).toEqual([]);
  });
});

describe("normalizeServiceCategory", () => {
  it("passes known keys through and maps anything else to other", () => {
    expect(normalizeServiceCategory("brakes")).toBe("brakes");
    expect(normalizeServiceCategory("Brakes")).toBe("other");
    expect(normalizeServiceCategory(undefined)).toBe("other");
  });
});

describe("ServiceFormSchema category", () => {
  const base = { name: "Oil change", durationMinutes: "60", pricingType: "fixed", price: "89" };

  it("requires a category", () => {
    const result = ServiceFormSchema.safeParse({ ...base, category: null });
    expect(result.success).toBe(false);
    expect(result.error?.flatten().fieldErrors.category).toBeDefined();
  });

  it("rejects a key outside the fixed list", () => {
    expect(ServiceFormSchema.safeParse({ ...base, category: "spaceship" }).success).toBe(false);
  });

  it("accepts every fixed category", () => {
    for (const category of SERVICE_CATEGORIES) {
      expect(ServiceFormSchema.safeParse({ ...base, category }).success).toBe(true);
    }
  });
});

describe("service category labels", () => {
  it("has an EN and FR label for every category", () => {
    for (const category of SERVICE_CATEGORIES) {
      expect(en.serviceCategories[category]).toBeTruthy();
      expect(fr.serviceCategories[category]).toBeTruthy();
    }
  });
});
