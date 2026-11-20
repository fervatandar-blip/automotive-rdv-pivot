// Fixed service categories (0048). Keys are stored in services.category and
// must match the services_category_check constraint; labels live in the
// dictionaries under "serviceCategories". The array order is the display
// order, with "other" always last.

export const SERVICE_CATEGORIES = [
  "maintenance",
  "brakes",
  "tires",
  "diagnostics",
  "engine",
  "electrical",
  "air_conditioning",
  "bodywork",
  "other",
] as const;

export type ServiceCategory = (typeof SERVICE_CATEGORIES)[number];

export type ServiceCategoryLabels = Record<ServiceCategory, string>;

export function normalizeServiceCategory(value: unknown): ServiceCategory {
  return SERVICE_CATEGORIES.includes(value as ServiceCategory)
    ? (value as ServiceCategory)
    : "other";
}

/**
 * Groups services by category in display order, dropping empty categories
 * and keeping each group's incoming order (callers sort by created_at).
 */
export function groupServicesByCategory<T extends { category?: string | null }>(
  services: readonly T[]
): { category: ServiceCategory; services: T[] }[] {
  const buckets = new Map<ServiceCategory, T[]>();
  for (const service of services) {
    const category = normalizeServiceCategory(service.category);
    const bucket = buckets.get(category);
    if (bucket) bucket.push(service);
    else buckets.set(category, [service]);
  }
  return SERVICE_CATEGORIES.filter((category) => buckets.has(category)).map((category) => ({
    category,
    services: buckets.get(category)!,
  }));
}
