export const COUNTRIES = ["LU", "BE", "FR", "DE"] as const;

export type Country = (typeof COUNTRIES)[number];

export const COUNTRY_NAMES: Record<Country, string> = {
  LU: "Luxembourg",
  BE: "Belgium",
  FR: "France",
  DE: "Germany",
};

// Lenient sanity checks, not authoritative validation against each
// country's real business registrar -- the existing vat_number field has
// no validation at all today, so even a rough format check is an
// improvement, but these deliberately don't try to be a source of truth.
export const REGISTRATION_CONFIG: Record<
  Country,
  { label: string; placeholder: string; hint: string; pattern: RegExp }
> = {
  LU: {
    label: "RCS/LBR number",
    placeholder: "B123456",
    hint: "Luxembourg Business Registers (RCS) number.",
    pattern: /^[A-Za-z]\d{4,7}$/,
  },
  BE: {
    label: "BCE/KBO number",
    placeholder: "0123.456.789",
    hint: "Belgian Crossroads Bank for Enterprises (BCE/KBO) number.",
    pattern: /^\d{4}\.?\d{3}\.?\d{3}$/,
  },
  FR: {
    label: "SIRET number",
    placeholder: "123 456 789 00012",
    hint: "French SIRET number (14 digits).",
    pattern: /^\d{3}\s?\d{3}\s?\d{3}\s?\d{5}$/,
  },
  DE: {
    label: "Handelsregisternummer",
    placeholder: "HRB 123456",
    hint: "German commercial register number (HRA/HRB).",
    pattern: /^HR[AB]\s?\d{3,7}$/i,
  },
};
