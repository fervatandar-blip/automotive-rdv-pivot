import { describe, expect, it } from "vitest";
import { escapeHtml } from "@/lib/email";

describe("escapeHtml", () => {
  it("neutralises markup in user-controlled names", () => {
    expect(escapeHtml('<a href="https://evil.example">Click</a>')).toBe(
      "&lt;a href=&quot;https://evil.example&quot;&gt;Click&lt;/a&gt;"
    );
  });

  it("escapes ampersands first so entities aren't double-decoded", () => {
    expect(escapeHtml("Tom & Jerry's &lt;garage&gt;")).toBe(
      "Tom &amp; Jerry&#39;s &amp;lt;garage&amp;gt;"
    );
  });

  it("leaves ordinary names untouched", () => {
    expect(escapeHtml("Garage Müller-Schmit")).toBe("Garage Müller-Schmit");
  });
});
