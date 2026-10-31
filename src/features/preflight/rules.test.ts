import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import ro from "@/locales/ro.json";
import { arrivalHours, buildChecklist, daysUntil, isSchengen, type PreflightInput } from "./rules";

const today = new Date(2026, 10, 1);
const trip = (over: Partial<PreflightInput> = {}): PreflightInput => ({
  origin: { iata: "CRA", city: "Craiova", countryCode: "RO" },
  destination: { iata: "BGY", city: "Milan", countryCode: "IT" },
  date: "2026-11-20",
  citizenship: "ro",
  bag: "cabin",
  airline: "",
  children: false,
  medication: false,
  pet: false,
  lang: "en",
  ...over,
});
const keys = (input: PreflightInput) => buildChecklist(input, today).map((i) => i.key);

describe("pre-flight checklist", () => {
  it("lets Romanians fly inside the EU with an ID card and skips customs", () => {
    const list = keys(trip());
    expect(list).toContain("idCardOk");
    expect(list).not.toContain("passportNeeded");
    expect(list).not.toContain("cash");
    expect(list).toContain("eu261");
    expect(list).toContain("liquids");
    expect(list).toContain("powerBank");
  });

  it("asks for a passport and ETA for the UK, with customs both ways", () => {
    const list = keys(trip({ destination: { iata: "LTN", city: "London", countryCode: "GB" } }));
    expect(list).toEqual(
      expect.arrayContaining(["passportNeeded", "ukEta", "cash", "renewEarly", "maeAlerts"]),
    );
    expect(list).not.toContain("meatDairy");
    expect(list).not.toContain("allowances");
    const back = keys(
      trip({
        origin: { iata: "LTN", city: "London", countryCode: "GB" },
        destination: { iata: "OTP", city: "Bucharest", countryCode: "RO" },
      }),
    );
    expect(back).toEqual(expect.arrayContaining(["meatDairy", "allowances", "eu261Inbound"]));
    expect(back).not.toContain("eu261");
  });

  it("covers non-EU travellers entering Schengen with EES", () => {
    const list = keys(
      trip({ citizenship: "other", origin: { iata: "LTN", city: "London", countryCode: "GB" } }),
    );
    expect(list).toEqual(expect.arrayContaining(["visaCheck", "ees"]));
  });

  it("adds Romanian parental consent, medication and pet items when flagged", () => {
    const list = keys(trip({ children: true, medication: true, pet: true }));
    expect(list).toEqual(expect.arrayContaining(["childrenRo", "medication", "pet", "babyFood"]));
  });

  it("recommends more time at the airport outside Schengen", () => {
    expect(isSchengen("RO")).toBe(true);
    expect(isSchengen("IE")).toBe(false);
    expect(arrivalHours(trip())).toBe(2);
    expect(arrivalHours(trip({ bag: "checked" }))).toBe(2.5);
    expect(
      arrivalHours(trip({ destination: { iata: "DUB", city: "Dublin", countryCode: "IE" } })),
    ).toBe(3);
  });

  it("counts days until the flight", () => {
    expect(daysUntil("2026-11-20", today)).toBe(19);
    expect(daysUntil("2026-10-31", today)).toBe(-1);
  });

  it("has an EN and RO text for every rule it can produce", () => {
    const all = new Set(
      [
        trip(),
        trip({
          citizenship: "other",
          children: true,
          medication: true,
          pet: true,
          bag: "checked",
          destination: { iata: "JFK", city: "New York", countryCode: "US" },
        }),
        trip({
          destination: { iata: "LTN", city: "London", countryCode: "GB" },
          children: true,
          citizenship: "eu",
        }),
        trip({ destination: { iata: "KIV", city: "Chișinău", countryCode: "MD" } }),
      ].flatMap(keys),
    );
    for (const key of all) {
      for (const dict of [en, ro]) {
        const rule = (dict.preflight.rule as Record<string, { title: string; detail: string }>)[
          key
        ];
        expect(rule?.title, key).toBeTruthy();
        expect(rule?.detail, key).toBeTruthy();
      }
    }
  });
});
