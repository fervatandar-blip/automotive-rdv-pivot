// How a service is priced (0045). Repair prices depend on the vehicle, so a
// garage can list a fixed price, a starting price, or none until inspection.

export const PRICING_TYPES = ["fixed", "from", "on_inspection"] as const;
export type PricingType = (typeof PRICING_TYPES)[number];

export type ServicePrice = {
  pricing_type: PricingType | string | null;
  price: number | string | null;
};

export type PriceLabels = {
  // "From {price}" / "À partir de {price}"
  priceFrom: string;
  priceOnInspection: string;
};

// Euro amounts are shown the Luxembourg way in both languages ("89,00 €"),
// matching invoices (lib/invoice-pdf.tsx).
const currencyFormatter = new Intl.NumberFormat("fr-LU", {
  style: "currency",
  currency: "EUR",
});

export function formatEuro(amount: number) {
  return currencyFormatter.format(amount);
}

export function normalizePricingType(value: unknown): PricingType {
  return PRICING_TYPES.includes(value as PricingType) ? (value as PricingType) : "fixed";
}

/**
 * The price as clients and staff read it: "89,00 €", "From 89,00 €" or
 * "Price on inspection". A row missing its amount (shouldn't happen past the
 * 0045 check) reads as on inspection rather than "0,00 €".
 */
export function formatServicePrice(service: ServicePrice, labels: PriceLabels) {
  const type = normalizePricingType(service.pricing_type);
  const amount = service.price === null || service.price === "" ? NaN : Number(service.price);

  if (type === "on_inspection" || !Number.isFinite(amount)) {
    return labels.priceOnInspection;
  }
  const formatted = formatEuro(amount);
  return type === "from" ? labels.priceFrom.replace("{price}", formatted) : formatted;
}

/** Only a fixed price is what the client owes, so only it can be invoiced as is. */
export function isInvoiceablePrice(service: ServicePrice): service is ServicePrice & { price: number | string } {
  return normalizePricingType(service.pricing_type) === "fixed" && service.price !== null;
}
