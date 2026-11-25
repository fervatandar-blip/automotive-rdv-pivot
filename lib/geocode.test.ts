import { afterEach, describe, expect, it, vi } from "vitest";
import { geocodeAddress, shouldGeocode } from "./geocode";

const stored = { address: "12 Rue de Bonnevoie", city: "Luxembourg", latitude: 49.6006, longitude: 6.1342 };

describe("shouldGeocode", () => {
  it("geocodes a changed address when the pin was left alone", () => {
    expect(shouldGeocode({ stored, submitted: { ...stored, address: "5 Rue du Fort Wallis" } })).toBe(true);
    expect(shouldGeocode({ stored, submitted: { ...stored, city: "Esch-sur-Alzette" } })).toBe(true);
  });

  it("keeps a pin the user moved by hand", () => {
    expect(
      shouldGeocode({ stored, submitted: { ...stored, address: "5 Rue du Fort Wallis", latitude: 49.61 } })
    ).toBe(false);
  });

  it("geocodes when there is no pin yet, and not when nothing changed", () => {
    expect(shouldGeocode({ stored, submitted: { ...stored, latitude: null, longitude: null } })).toBe(true);
    expect(shouldGeocode({ stored, submitted: { ...stored, address: " 12  rue de bonnevoie " } })).toBe(false);
  });

  it("never geocodes an empty address", () => {
    expect(
      shouldGeocode({ stored, submitted: { address: "", city: " ", latitude: null, longitude: null } })
    ).toBe(false);
  });
});

describe("geocodeAddress", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const reply = (body: unknown, ok = true) =>
    vi.fn(async () => ({ ok, status: ok ? 200 : 500, json: async () => body }) as unknown as Response);

  it("returns null without a key or an address, without calling Google", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "");
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAPS_API_KEY", "");
    const fetchImpl = reply({});
    expect(await geocodeAddress({ address: "12 Rue X", city: "Luxembourg" }, fetchImpl)).toBeNull();
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "k");
    expect(await geocodeAddress({ address: " ", city: null }, fetchImpl)).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("reads the first result and pins the country", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "k");
    const fetchImpl = reply({ status: "OK", results: [{ geometry: { location: { lat: 49.6, lng: 6.13 } } }] });
    expect(await geocodeAddress({ address: "12 Rue de Bonnevoie", city: "Luxembourg", country: "LU" }, fetchImpl)).toEqual({
      latitude: 49.6,
      longitude: 6.13,
    });
    const url = new URL((fetchImpl.mock.calls[0] as unknown as [string])[0]);
    expect(url.searchParams.get("address")).toBe("12 Rue de Bonnevoie, Luxembourg");
    expect(url.searchParams.get("components")).toBe("country:LU");
  });

  it("returns null on no result, an error status or a network failure", async () => {
    vi.stubEnv("GOOGLE_MAPS_SERVER_KEY", "k");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(await geocodeAddress({ address: "x", city: "y" }, reply({ status: "ZERO_RESULTS" }))).toBeNull();
    expect(await geocodeAddress({ address: "x", city: "y" }, reply({ status: "REQUEST_DENIED" }))).toBeNull();
    expect(await geocodeAddress({ address: "x", city: "y" }, reply({}, false))).toBeNull();
    const failing = vi.fn(async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    expect(await geocodeAddress({ address: "x", city: "y" }, failing)).toBeNull();
    warn.mockRestore();
  });
});
