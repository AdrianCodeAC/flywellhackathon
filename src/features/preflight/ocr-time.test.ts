import { describe, expect, it } from "vitest";
import { extractDepartureTime } from "./ocr-time";

describe("extractDepartureTime", () => {
  it("reads the time next to a Departure label", () => {
    expect(
      extractDepartureTime("WIZZ AIR\nOTP -> MAD\nDeparture 14:35\nSeat 14C"),
    ).toBe("14:35");
  });

  it("falls back to Gate closes / Boarding when no Departure line exists", () => {
    expect(extractDepartureTime("Gate closes 09:20\nHave a nice flight")).toBe("09:20");
    expect(extractDepartureTime("BOARDING 18.05")).toBe("18:05");
  });

  it("prefers Departure over Gate closes when both appear", () => {
    expect(extractDepartureTime("Gate closes 14:20\nDeparture 14:50")).toBe("14:50");
  });

  it("pads single-digit hours and ignores invalid times", () => {
    expect(extractDepartureTime("Dep 7:05")).toBe("07:05");
    expect(extractDepartureTime("Departure 25:99")).toBeNull();
  });

  it("returns null when no labelled time exists", () => {
    expect(extractDepartureTime("WIZZ AIR\nBucharest to Madrid")).toBeNull();
  });
});
