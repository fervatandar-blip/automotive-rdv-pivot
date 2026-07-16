export const locales = ["fr", "en"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "fr";

export function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

/** Reads a "lang" hidden form field back into a known Locale, falling back to the default. */
export function parseLocale(value: FormDataEntryValue | null): Locale {
  return typeof value === "string" && isLocale(value) ? value : defaultLocale;
}

/**
 * Next's generated PageProps/LayoutProps type `params.lang` as plain `string`
 * (from generateStaticParams), which is wider than our Locale union — narrow
 * it back down after reading `params`, rather than typing `params` itself as
 * `Locale` (that would fail Next's own route-type validator).
 */
export function resolveLocale(value: string): Locale {
  return isLocale(value) ? value : defaultLocale;
}
