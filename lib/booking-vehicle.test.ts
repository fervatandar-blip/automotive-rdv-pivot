import { describe, expect, it } from "vitest";
import { parseBookingVehicle, withBookingVehicle } from "@/lib/booking-vehicle";

const ID = "3F2504E0-4F89-41D3-9A0C-0305E82C3301";

describe("parseBookingVehicle", () => {
  it("accepts a UUID (normalized to lower case)", () => {
    expect(parseBookingVehicle(ID)).toBe(ID.toLowerCase());
  });

  it("drops anything else, so it can't be echoed into links", () => {
    expect(parseBookingVehicle("abc")).toBeNull();
    expect(parseBookingVehicle(`${ID}&service=x`)).toBeNull();
    expect(parseBookingVehicle(undefined)).toBeNull();
    expect(parseBookingVehicle(["a"])).toBeNull();
  });
});

describe("withBookingVehicle", () => {
  it("adds the param with ? or & as needed", () => {
    expect(withBookingVehicle("/en/garages/1", "v")).toBe("/en/garages/1?vehicle=v");
    expect(withBookingVehicle("/en/garages/1?service=s", "v")).toBe("/en/garages/1?service=s&vehicle=v");
  });

  it("keeps a #fragment last", () => {
    expect(withBookingVehicle("/en/garages/1?time=09:00#confirm-booking", "v")).toBe(
      "/en/garages/1?time=09:00&vehicle=v#confirm-booking"
    );
  });

  it("leaves the href alone without a vehicle", () => {
    expect(withBookingVehicle("/en/garages", null)).toBe("/en/garages");
  });
});
