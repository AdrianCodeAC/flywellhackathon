import { describe, expect, it } from "vitest";
import { arrivalSteps, departureSteps, placeSteps } from "./journey";
import { gateMatches, parseOsmMap, poiKind, terminalRole, type AirportLayout, type OsmElement } from "./layout";

const trip = (from: string, to: string, bag: "cabin" | "checked") => ({
  origin: { iata: "AAA", city: "A", countryCode: from },
  destination: { iata: "BBB", city: "Bergamo", countryCode: to },
  bag,
});
const ids = (steps: { id: string }[]) => steps.map((s) => s.id);

describe("airport journey steps", () => {
  it("cabin bag inside Schengen skips bag drop and passport control", () => {
    expect(ids(departureSteps(trip("RO", "IT", "cabin")))).toEqual(["arrive", "security", "gate"]);
    expect(ids(arrivalSteps(trip("RO", "IT", "cabin")))).toEqual(["exit"]);
  });

  it("checked bag adds bag drop before security and baggage claim on arrival", () => {
    expect(ids(departureSteps(trip("RO", "IT", "checked")))).toEqual(["arrive", "checkin", "security", "gate"]);
    expect(ids(arrivalSteps(trip("RO", "IT", "checked")))).toEqual(["baggage", "exit"]);
  });

  it("leaving Schengen adds passport control on both sides", () => {
    expect(ids(departureSteps(trip("RO", "GB", "cabin")))).toEqual(["arrive", "security", "passportOut", "gate"]);
    expect(ids(arrivalSteps(trip("RO", "GB", "cabin")))).toContain("passportIn");
  });

  it("customs only when the flight crosses the EU border", () => {
    expect(ids(arrivalSteps(trip("RO", "GB", "checked")))).toEqual(["passportIn", "baggage", "customs", "exit"]);
    expect(ids(arrivalSteps(trip("RO", "CY", "checked")))).not.toContain("customs");
  });

  it("asks to arrive 2.5 h early for a checked bag inside Schengen", () => {
    expect(departureSteps(trip("RO", "IT", "checked"))[0]?.params?.["hours"]).toBe(2.5);
  });
});

describe("airport layout", () => {
  it("classifies passenger services and terminal halls", () => {
    expect(poiKind({ aeroway: "gate", ref: "12" })).toBe("gate");
    expect(poiKind({ amenity: "security_control" })).toBe("security");
    expect(poiKind({ barrier: "border_control" })).toBe("passport");
    expect(poiKind({ aeroway: "taxiway" })).toBeUndefined();
    expect(terminalRole("Aeroportul Otopeni Henri Coandă - Plecări")).toBe("departures");
    expect(terminalRole("Sosiri Externe")).toBe("arrivals");
  });

  it("matches typed gates inside shared and ranged refs", () => {
    expect(gateMatches("28/29", "29")).toBe(true);
    expect(gateMatches("A12-A14", "a13")).toBe(true);
    expect(gateMatches("A12-A14", "B13")).toBe(false);
    expect(gateMatches("2", "12")).toBe(false);
  });

  const elements: OsmElement[] = [
    { type: "node", id: 1, lat: 44.57, lon: 26.08 },
    { type: "node", id: 2, lat: 44.57, lon: 26.09 },
    { type: "node", id: 3, lat: 44.575, lon: 26.09 },
    { type: "node", id: 4, lat: 44.575, lon: 26.08 },
    { type: "way", id: 10, nodes: [1, 2, 3, 4, 1], tags: { aeroway: "terminal", name: "Departures" } },
    { type: "node", id: 5, lat: 44.574, lon: 26.085, tags: { aeroway: "gate", ref: "14" } },
    { type: "node", id: 6, lat: 44.572, lon: 26.083, tags: { amenity: "security_control" } },
    { type: "node", id: 7, lat: 44.6, lon: 26.2, tags: { amenity: "toilets" } },
  ];
  const layout: AirportLayout = parseOsmMap("OTP", elements, [44.56, 26.07, 44.58, 26.1]);

  it("keeps only services inside the mapped area", () => {
    expect(layout.terminals).toHaveLength(1);
    expect(layout.pois.map((p) => p.kind).sort()).toEqual(["gate", "security"]);
  });

  it("puts mapped steps on their exact spot and the typed gate on that gate", () => {
    const placed = placeSteps(departureSteps(trip("RO", "IT", "checked")), layout, "departures", "14");
    expect(placed.find((s) => s.id === "security")).toMatchObject({ exact: true, at: [44.572, 26.083] });
    expect(placed.find((s) => s.id === "gate")).toMatchObject({ exact: true, label: "14" });
    expect(placed.find((s) => s.id === "checkin")?.exact).toBe(false);
  });
});
