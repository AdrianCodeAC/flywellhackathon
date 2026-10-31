import { describe, expect, it } from "vitest";
import { pickStart } from "./start-point";
import { distanceMeters } from "./place-utils";

const MAD = { lat: 40.4719, lon: -3.5626 };

describe("pickStart", () => {
  it("measures from the phone when it is in the destination city", () => {
    const sol: [number, number] = [40.4168, -3.7038];
    expect(pickStart(MAD, sol)).toEqual({ lat: 40.4168, lon: -3.7038, source: "you", far: false });
  });

  it("measures from the airport when the phone is still at home", () => {
    const craiova: [number, number] = [44.3302, 23.7949];
    expect(pickStart(MAD, craiova)).toEqual({ ...MAD, source: "airport", far: true });
  });

  it("measures from the airport without a location", () => {
    expect(pickStart(MAD, null)).toEqual({ ...MAD, source: "airport", far: false });
  });

  it("card distance and route start agree: a central restaurant is ~13 km from the airport, not 100 m", () => {
    const start = pickStart(MAD, null);
    const restaurant: [number, number] = [40.4170, -3.7040];
    expect(distanceMeters([start.lat, start.lon], restaurant)).toBeGreaterThan(12_000);
  });
});
