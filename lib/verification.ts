// Garage verification levels (garages.verification_level, 0004), from the
// "Suggested Verification Levels" in docs/ONBOARDING RDV.pdf. Set only by a
// super admin (setVerificationLevel, app/actions/documents.ts); the column is
// not writable by garage owners (0034). Order is lowest to highest trust.

export const VERIFICATION_LEVELS = [
  "basic",
  "verified",
  "ev_certified",
  "trusted_partner",
] as const;

export type VerificationLevel = (typeof VERIFICATION_LEVELS)[number];

export function isVerificationLevel(value: unknown): value is VerificationLevel {
  return VERIFICATION_LEVELS.includes(value as VerificationLevel);
}

/** Unknown or missing values read as "basic": never overstate trust. */
export function normalizeVerificationLevel(value: unknown): VerificationLevel {
  return isVerificationLevel(value) ? value : "basic";
}
