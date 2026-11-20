import { describe, expect, it } from "vitest";
import { isVerificationLevel, normalizeVerificationLevel, VERIFICATION_LEVELS } from "@/lib/verification";
import en from "@/lib/i18n/dictionaries/en.json";
import fr from "@/lib/i18n/dictionaries/fr.json";

describe("verification levels", () => {
  it("accepts only the four tiers", () => {
    for (const level of VERIFICATION_LEVELS) expect(isVerificationLevel(level)).toBe(true);
    expect(isVerificationLevel("gold")).toBe(false);
    expect(isVerificationLevel(null)).toBe(false);
  });

  it("never overstates trust for an unknown or missing level", () => {
    expect(normalizeVerificationLevel("trusted_partner")).toBe("trusted_partner");
    expect(normalizeVerificationLevel("gold")).toBe("basic");
    expect(normalizeVerificationLevel(undefined)).toBe("basic");
  });

  it("has an EN and FR label and description for every tier", () => {
    for (const level of VERIFICATION_LEVELS) {
      for (const dictionary of [en, fr]) {
        expect(dictionary.verificationLevels[level].label).toBeTruthy();
        expect(dictionary.verificationLevels[level].description).toBeTruthy();
      }
    }
  });
});
