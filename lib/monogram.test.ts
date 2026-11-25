import { describe, expect, it } from "vitest";
import { monogram } from "./monogram";

describe("monogram", () => {
  it("takes the first letter of the first two words", () => {
    expect(monogram("Garage Muller")).toBe("GM");
    expect(monogram("auto-service kirchberg")).toBe("AS");
  });
  it("ignores parenthesised notes and symbols", () => {
    expect(monogram("RDV Demo Garage (test)")).toBe("RD");
    expect(monogram("Pneus & Co")).toBe("PC");
  });
  it("handles one word, accents and empty names", () => {
    expect(monogram("Électro")).toBe("É");
    expect(monogram("")).toBe("?");
  });
});
