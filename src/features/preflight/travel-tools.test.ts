import { describe, expect, it } from "vitest";
import { flightDate, parseBoardingPass } from "./bcbp";
import { AIRLINES, findAirline } from "./airlines";
import { jetLagPlan, utcOffset } from "./jetlag";
import { parseWeather, skyFromCode, whatToWear } from "@/features/arrival/weather";

// Sample from the IATA BCBP implementation guide, rewritten for a Craiova–Bergamo flight.
const PASS = "M1POPESCU/ANDREI      EABC123 CRABGYW6 3101 324Y012A0045 100";

describe("boarding pass", () => {
  it("reads the mandatory fields", () => {
    expect(PASS.length).toBe(60);
    expect(parseBoardingPass(PASS)).toEqual({
      name: "ANDREI POPESCU",
      pnr: "ABC123",
      from: "CRA",
      to: "BGY",
      carrier: "W6",
      flight: "3101",
      julianDay: 324,
      compartment: "Y",
      seat: "12A",
    });
  });

  it("rejects other barcodes", () => {
    expect(parseBoardingPass("https://example.com")).toBeNull();
    expect(parseBoardingPass("M1" + "x".repeat(60))).toBeNull();
  });

  it("puts the day of year in the coming twelve months", () => {
    const today = new Date(2026, 9, 31);
    expect(flightDate(324, today)).toBe("2026-11-20");
    expect(flightDate(303, today)).toBe("2026-10-30"); // scanned just after the flight
    expect(flightDate(10, today)).toBe("2027-01-10");
  });
});

describe("airline baggage", () => {
  it("finds airlines by code, flight or name", () => {
    expect(findAirline("W6")?.name).toBe("Wizz Air");
    expect(findAirline("Wizz Air W6 3101")?.name).toBe("Wizz Air");
    expect(findAirline("fr 1234")?.name).toBe("Ryanair");
    expect(findAirline("TAROM")?.name).toBe("TAROM");
    expect(findAirline("Some Other Air")).toBeUndefined();
    expect(findAirline("")).toBeUndefined();
  });

  it("has an official link and at least one fare for every airline", () => {
    for (const a of AIRLINES) {
      expect(a.url).toMatch(/^https:\/\//);
      expect(a.fares.length).toBeGreaterThan(0);
    }
  });
});

describe("jet lag", () => {
  const nov = new Date("2026-11-20T12:00:00Z");
  it("reads legal offsets including daylight saving", () => {
    expect(utcOffset("Europe/Bucharest", nov)).toBe(2);
    expect(utcOffset("Europe/Bucharest", new Date("2026-07-01T12:00:00Z"))).toBe(3);
    expect(utcOffset("Asia/Kolkata", nov)).toBe(5.5);
  });

  it("needs no plan inside Europe", () => {
    expect(jetLagPlan("Europe/Bucharest", "Europe/Rome", nov).direction).toBe("none");
  });

  it("plans eastward and westward shifts", () => {
    const dubai = jetLagPlan("Europe/Bucharest", "Asia/Dubai", nov);
    expect(dubai).toMatchObject({ difference: 2, direction: "east", prepDays: 1 });
    const ny = jetLagPlan("Europe/Bucharest", "America/New_York", nov);
    expect(ny).toMatchObject({ difference: -7, direction: "west", shift: 7, prepDays: 3 });
    const tokyo = jetLagPlan("Europe/Bucharest", "Asia/Tokyo", nov);
    expect(tokyo.direction).toBe("east");
    expect(tokyo.recoveryDays).toBe(7);
    // Los Angeles → Tokyo is 17 h ahead: easier as a 7 h delay
    expect(jetLagPlan("America/Los_Angeles", "Asia/Tokyo", nov)).toMatchObject({
      difference: 17,
      direction: "west",
      shift: 7,
    });
  });
});

describe("weather", () => {
  it("groups WMO codes", () => {
    expect(skyFromCode(0)).toBe("clear");
    expect(skyFromCode(3)).toBe("cloudy");
    expect(skyFromCode(63)).toBe("rain");
    expect(skyFromCode(81)).toBe("rain");
    expect(skyFromCode(73)).toBe("snow");
    expect(skyFromCode(95)).toBe("storm");
  });

  it("suggests clothes for the conditions", () => {
    const base = { day: "now", code: 0, rainChance: 0, windKmh: 5 };
    expect(whatToWear({ ...base, temp: -3, low: -6, code: 71 })).toEqual([
      "winterCoat",
      "hatGloves",
      "boots",
    ]);
    expect(whatToWear({ ...base, temp: 8, low: 4, code: 61, windKmh: 40 })).toEqual([
      "warmJacket",
      "umbrella",
      "windproof",
    ]);
    expect(whatToWear({ ...base, temp: 30, low: 18 })).toEqual([
      "lightClothes",
      "sunWater",
      "layers",
    ]);
  });

  it("parses current and daily responses", () => {
    expect(
      parseWeather({
        current: {
          temperature_2m: 12.4,
          apparent_temperature: 10.6,
          weather_code: 61,
          precipitation: 0.3,
          wind_speed_10m: 14.2,
        },
      }),
    ).toEqual({ day: "now", temp: 12, low: 11, code: 61, rainChance: 100, windKmh: 14 });
    expect(
      parseWeather(
        {
          daily: {
            time: ["2026-11-20"],
            temperature_2m_max: [14.6],
            temperature_2m_min: [5.2],
            weather_code: [3],
            precipitation_probability_max: [40],
            wind_speed_10m_max: [22.4],
          },
        },
        "2026-11-20",
      ),
    ).toEqual({ day: "2026-11-20", temp: 15, low: 5, code: 3, rainChance: 40, windKmh: 22 });
    expect(parseWeather({}, "2026-11-20")).toBeNull();
  });
});
