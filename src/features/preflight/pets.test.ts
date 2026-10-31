import { describe, expect, it } from "vitest";
import en from "@/locales/en.json";
import ro from "@/locales/ro.json";
import { findPetPolicy, petEntryRule, PET_POLICIES } from "./pets";
import { buildChecklist, type PreflightInput } from "./rules";

const trip = (over: Partial<PreflightInput> = {}): PreflightInput => ({
  origin: { iata: "OTP", city: "Bucharest", countryCode: "RO" },
  destination: { iata: "BGY", city: "Milan", countryCode: "IT" },
  date: "2026-11-20",
  citizenship: "ro",
  bag: "cabin",
  airline: "",
  children: false,
  medication: false,
  pet: true,
  lang: "en",
  ...over,
});
const keys = (input: PreflightInput) => buildChecklist(input, new Date(2026, 10, 1)).map((i) => i.key);

describe("pet rules per airline", () => {
  it("Wizz Air, Ryanair and easyJet carry no pets", () => {
    for (const name of ["Wizz Air", "W6 3101", "Ryanair", "FR 123", "easyJet"]) {
      const p = findPetPolicy(name);
      expect(p?.cabin).toBeNull();
      expect(p?.hold.kind).toBe("no");
      const list = keys(trip({ airline: name }));
      expect(list).toContain("petAirlineNo");
      // No redundant destination pet rules when the pet cannot fly anyway.
      expect(list.filter((k) => k.startsWith("pet"))).toEqual(["petAirlineNo"]);
    }
  });

  it("TAROM and Lufthansa take pets up to 8 kg in the cabin", () => {
    expect(findPetPolicy("TAROM")?.cabin?.kg).toBe(8);
    expect(findPetPolicy("LH 1657")?.cabin?.kg).toBe(8);
    expect(keys(trip({ airline: "TAROM" }))).toContain("petAirlineCabin");
  });

  it("Vueling allows 10 kg in the cabin and no hold", () => {
    const p = findPetPolicy("Vueling");
    expect(p?.cabin?.kg).toBe(10);
    expect(p?.hold.kind).toBe("no");
  });

  it("British Airways only via cargo", () => {
    expect(findPetPolicy("British Airways")?.hold.kind).toBe("cargo");
  });

  it("does not guess an airline from unrelated words", () => {
    expect(findPetPolicy("pilot")).toBeUndefined();
    expect(keys(trip())).toContain("petAirlineUnknown");
  });
});

describe("pet entry rules per destination", () => {
  it("uses the destination country, not only EU rules", () => {
    expect(petEntryRule("RO", "IT")).toBe("eu");
    expect(petEntryRule("GB", "RO")).toBe("intoEu");
    expect(petEntryRule("RO", "GB")).toBe("gb");
    expect(petEntryRule("RO", "US")).toBe("us");
    expect(petEntryRule("RO", "TR")).toBe("tr");
    expect(petEntryRule("RO", "AE")).toBe("ae");
    expect(petEntryRule("RO", "EG")).toBe("other");
  });

  it("into Great Britain the pet must fly as cargo even with a cabin-pet airline", () => {
    const list = keys(trip({ airline: "Lufthansa", destination: { iata: "LHR", city: "London", countryCode: "GB" } }));
    expect(list).toContain("pet_gb");
    expect(list).not.toContain("petAirlineCabin");
  });

  it("has EN and RO texts for every airline note and pet rule", () => {
    const notes = new Set(PET_POLICIES.flatMap((p) => p.notes));
    for (const dict of [en, ro]) {
      const pets = dict.preflight.pets as unknown as { note: Record<string, string> };
      for (const n of notes) expect(pets.note[n], n).toBeTruthy();
      const rules = dict.preflight.rule as Record<string, unknown>;
      for (const k of ["pet_eu", "pet_intoEu", "pet_gb", "pet_us", "pet_usCats", "pet_tr", "pet_ae", "pet_other", "petAirlineUnknown", "petAirlineNo", "petAirlineCabin", "petAirlineCargo"])
        expect(rules[k], k).toBeTruthy();
    }
  });
});

import { isPetItem, repeatsChecklist } from "./ai-dedupe";
describe("AI pet duplicates", () => {
  it("drops AI checklist items about pets", () => {
    expect(isPetItem({ title: "Pașaport european și microcip pentru animal", source: "euPets" })).toBe(true);
    expect(isPetItem({ title: "Verifică vaccinarea antirabică din timp", source: "euPets" })).toBe(true);
    expect(isPetItem({ title: "Pet passport", source: null })).toBe(true);
    expect(isPetItem({ title: "No e-cigarettes in Thailand", source: null })).toBe(false);
  });
});

describe("AI items never repeat the fixed checklist", () => {
  it("drops 'no visa needed' when an ID card / passport item exists", () => {
    expect(repeatsChecklist({ title: "No visa needed for a short visit" }, ["idCardOk"])).toBe(true);
    expect(repeatsChecklist({ title: "Nu ai nevoie de viză pentru Spania" }, ["idCardOk"])).toBe(true);
    expect(repeatsChecklist({ title: "Lichide în bagajul de mână" }, ["liquids"])).toBe(true);
  });
  it("keeps genuinely new, trip-specific items", () => {
    expect(repeatsChecklist({ title: "E-cigarettes are banned in Thailand" }, ["idCardOk", "liquids"])).toBe(false);
    expect(repeatsChecklist({ title: "Siesta: shops close 14:00–17:00" }, ["idCardOk"])).toBe(false);
  });
});
