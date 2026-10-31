import { describe, expect, it } from "vitest";
import { cleanWikiText, extractSection } from "./wikivoyage";
import { BOLT_URL, uberDeepLink } from "./ride-links";
import { parseAssistantAnswer } from "./assistant-schema";
import { pickArticle } from "./wikipedia";

describe("Wikivoyage parsing", () => {
  it("keeps only Get in > By plane and removes wiki markup", () => {
    const raw =
      "== Get in ==\n=== By plane ===\n* Take the [[Metro|metro]] {{see|x}}<ref>x</ref> to '''Centre'''.\n=== By train ===\nTrain\n== See ==\nNo";
    const section = extractSection(raw, "Get in", "By plane");
    expect(section).not.toContain("By train");
    expect(cleanWikiText(section ?? "")).toBe("Take the metro to Centre.");
  });
});

describe("ride links", () => {
  it("puts airport pickup and destination dropoff in Uber", () => {
    const url = new URL(
      uberDeepLink({ lat: 38.7742, lon: -9.1342 }, { lat: 38.7139, lon: -9.1394 }),
    );
    expect(url.searchParams.get("pickup[latitude]")).toBe("38.7742");
    expect(url.searchParams.get("dropoff[longitude]")).toBe("-9.1394");
    expect(BOLT_URL).toBe("https://m.bolt.eu/");
  });
});

describe("AI places", () => {
  it("keeps up to five valid tappable places", () => {
    const places = Array.from({ length: 7 }, (_, i) => ({
      name: `P${i}`,
      lat: 44 + i / 100,
      lon: 26,
    }));
    const out = parseAssistantAnswer({
      text: " Hi ",
      places: [{ name: "Bad", lat: 99, lon: 0 }, ...places],
    });
    expect(out.text).toBe("Hi");
    expect(out.places).toHaveLength(5);
    expect(out.places[0]?.name).toBe("P0");
  });
});

describe("Romanian Wikipedia choice", () => {
  it("uses Romanian, otherwise English", () => {
    expect(pickArticle({}, "ro", { ro: "Ateneul Român", en: "Romanian Athenaeum" })).toEqual({
      lang: "ro",
      title: "Ateneul Român",
    });
    expect(pickArticle({ wikipedia: "fr:Tour" }, "ro", { en: "Tower" })).toEqual({
      lang: "en",
      title: "Tower",
    });
  });
});

import { buildOverpassQuery, searchPlaces } from "./overpass.server";
import { destinationClock } from "./services";
it("searches sights within the specified 10 km without widening", async () => {
  const query = buildOverpassQuery("sights", 44.43, 26.1, 10000);
  expect(query).toContain("around:10000,");
  const res = await searchPlaces(
    "sights",
    44.43,
    26.1,
    10000,
    async () => new Response(JSON.stringify({ elements: [] })),
  );
  expect(res.radiusM).toBe(10000);
});
it("uses Bucharest's real winter local time", () => {
  expect(destinationClock(26.1, new Date("2026-10-30T19:15:00Z"), 44.57)).toContain("21:15");
});

import { areaViewbox, categorizeSight, foodSearchUrl, parseFoodHits } from "./place-sources";
it("builds the requested bounded Nominatim food search", () => {
  const url = new URL(foodSearchUrl("fast food", 44.3, 23.8, 1200));
  expect(url.searchParams.get("q")).toBe("fast food");
  expect(url.searchParams.get("limit")).toBe("40");
  expect(url.searchParams.get("bounded")).toBe("1");
  expect(url.searchParams.get("extratags")).toBe("1");
  expect(url.searchParams.get("viewbox")).toBe(areaViewbox(44.3, 23.8, 1200));
});
it("accepts null Nominatim extratags", () => {
  const out = parseFoodHits(
    [
      {
        osm_type: "node",
        osm_id: 1,
        name: "Bistro",
        type: "restaurant",
        lat: "44.3",
        lon: "23.8",
        extratags: null,
      },
    ],
    "restaurant",
    44.3,
    23.8,
  );
  expect(out[0]).toMatchObject({ name: "Bistro", kind: "restaurant" });
});
it("maps the requested Romanian and English sight categories", () => {
  expect(categorizeSight("Muzeul de Artă")).toBe("museum");
  expect(categorizeSight("Biserica Sfântul Dumitru")).toBe("church");
  expect(categorizeSight("Central Park")).toBe("park");
  expect(categorizeSight("Monumentul Eroilor")).toBe("monument");
});

import { DEFAULT_FOOD_AREA } from "./place-sources";
it("defaults food searches to city center", () => {
  expect(DEFAULT_FOOD_AREA).toBe("center");
});
it("uses an eight-second Overpass fallback query", () => {
  expect(buildOverpassQuery("food", 44.3, 23.8, 1200, 8000)).toContain("[timeout:8]");
});

import { interleaveByKind, widerFoodRadius, wikidataSearchUrl } from "./place-sources";

it("searches notable sights by type near the centre (not just the nearest articles)", () => {
  const url = new URL(wikidataSearchUrl(["Q22698", "Q22746"], 40.417, -3.704, 10_000, 12));
  expect(url.searchParams.get("srsearch")).toBe(
    "haswbstatement:P31=Q22698|P31=Q22746 nearcoord:10km,40.4170,-3.7040",
  );
  expect(url.searchParams.get("srlimit")).toBe("12");
});

it("interleaves kinds so parks are not crowded out by other sights", () => {
  const parks = [{ kind: "park" as const, n: 1 }, { kind: "park" as const, n: 2 }];
  const museums = [{ kind: "museum" as const, n: 3 }];
  expect(interleaveByKind([museums, parks]).map((x) => x.n)).toEqual([3, 1, 2]);
});

it("widens the food search once when fewer than 15 places are found, up to 4 km", () => {
  expect(widerFoodRadius(1500, 2)).toBe(3750);
  expect(widerFoodRadius(1500, 15)).toBeNull();
  expect(widerFoodRadius(2000, 0)).toBe(4000);
  expect(widerFoodRadius(4000, 0)).toBeNull();
});
