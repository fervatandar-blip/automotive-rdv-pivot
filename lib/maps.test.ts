import { describe, expect, it } from "vitest";
import { directionsUrl } from "@/lib/maps";

describe("directionsUrl", () => {
  it("routes to the map pin when the garage has one", () => {
    expect(directionsUrl({ name: "Garage A", city: "Luxembourg", latitude: 49.6116, longitude: 6.1319 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=49.6116%2C6.1319"
    );
  });

  it("falls back to the written address, including the name", () => {
    expect(directionsUrl({ name: "Garage A", address: "1 Rue de Hollerich", city: "Luxembourg" })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=" +
        encodeURIComponent("Garage A, 1 Rue de Hollerich, Luxembourg")
    );
  });

  it("returns null with nothing routable (a name alone is too vague)", () => {
    expect(directionsUrl({ name: "Garage A" })).toBeNull();
    expect(directionsUrl({ name: "Garage A", address: "  ", city: null })).toBeNull();
  });

  it("ignores a half-set or non-finite pin", () => {
    expect(directionsUrl({ city: "Esch", latitude: 49.5, longitude: null })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Esch"
    );
    expect(directionsUrl({ city: "Esch", latitude: Number.NaN, longitude: 6 })).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=Esch"
    );
  });
});
