import { describe, expect, it } from "vitest";
import { formatAirport, searchAirports } from "./airport-search";
import type { Airport } from "./types";

const ap = (iata: string, name: string, city: string, country = "Portugal"): Airport => ({
  iata, name, city, country, countryCode: "PT", lat: 0, lon: 0,
});
const data = [
  ap("LIS", "Humberto Delgado Airport", "Lisbon"),
  ap("OPO", "Francisco Sá Carneiro Airport", "Porto"),
  ap("LIL", "Lille Airport", "Lille", "France"),
];

describe("searchAirports", () => {
  it("needs at least 2 characters", () => {
    expect(searchAirports(data, "l")).toEqual([]);
  });
  it("matches IATA code first", () => {
    expect(searchAirports(data, "lis")[0]?.iata).toBe("LIS");
  });
  it("matches by city", () => {
    expect(searchAirports(data, "porto").map((a) => a.iata)).toEqual(["OPO"]);
  });
  it("matches by airport name", () => {
    expect(searchAirports(data, "delgado").map((a) => a.iata)).toEqual(["LIS"]);
  });
});

it("formats suggestions as 'LIS · Name, City, Country'", () => {
  expect(formatAirport(data[0]!)).toBe("LIS · Humberto Delgado Airport, Lisbon, Portugal");
});
