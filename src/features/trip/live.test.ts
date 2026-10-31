import { describe, expect, it } from "vitest";
import { liveParams, parseInsights, parseLiveFares, type LivePayload } from "./live";
import type { TripInput } from "./types";

const roundTrip: TripInput = {
  destination: "Bergamo", destinationIata: "BGY", origin: "CRA",
  departure: "2026-11-12", returnDate: "2026-11-16", adults: 2, children: 0,
  flexible: false, oneWay: false, budget: "budget", direct: false, bag: false, lang: "ro",
};

const fixture: LivePayload = {
  search_metadata: { google_flights_url: "https://www.google.com/travel/flights?tfs=CRA20261112BGY" },
  price_insights: { lowest_price: 478, price_level: "low", typical_price_range: { low_price: 430, high_price: 610 } },
  best_flights: [
    {
      price: 520, total_duration: 420, type: "Round trip",
      layovers: [{ duration: 90, name: "Barcelona" }],
      flights: [
        { departure_airport: { id: "CRA", time: "2026-11-12 05:40" }, arrival_airport: { id: "BCN", time: "2026-11-12 08:05" }, airline: "Ryanair", flight_number: "FR 123" },
        { departure_airport: { id: "BCN", time: "2026-11-12 09:35" }, arrival_airport: { id: "BGY", time: "2026-11-12 12:40" }, airline: "Ryanair", flight_number: "FR 456" },
      ],
    },
    {
      price: 478, total_duration: 135, type: "Round trip",
      flights: [{ departure_airport: { id: "CRA", time: "2026-11-12 06:15" }, arrival_airport: { id: "BGY", time: "2026-11-12 08:30" }, airline: "Wizz Air", flight_number: "W6 4401" }],
    },
    // A row with no fare is not a flight the traveller can buy: it must be dropped.
    { flights: [{ departure_airport: { id: "CRA", time: "2026-11-12 19:00" }, arrival_airport: { id: "BGY", time: "2026-11-12 21:00" }, airline: "Unknown" }] },
  ],
  other_flights: [],
};

describe("live Google Flights fares", () => {
  it("keeps real times, airline, flight number, stops and price", () => {
    const flights = parseLiveFares(fixture, roundTrip, "RON", "https://fallback.example");
    expect(flights).toHaveLength(2);
    expect(flights[0]).toMatchObject({
      airline: "Wizz Air", price: 478, currency: "RON", stops: 0, duration: 135,
      departure: "2026-11-12T06:15", arrival: "2026-11-12T08:30", flightNumber: "W6 4401", live: true,
      link: "https://www.google.com/travel/flights?tfs=CRA20261112BGY",
    });
    expect(flights[1]).toMatchObject({ stops: 1, layover: 90, duration: 420, flightNumber: "FR 123 + FR 456", price: 520 });
  });

  it("uses the requested return date for a round trip and the departure for one way", () => {
    const flights = parseLiveFares(fixture, roundTrip, "RON", "https://fallback.example");
    expect(flights[0]?.returnDate).toBe("2026-11-16");
    const oneWay = parseLiveFares(fixture, { ...roundTrip, oneWay: true, returnDate: "2026-11-12" }, "RON", "https://fallback.example");
    expect(oneWay[0]?.returnDate).toBe("2026-11-12T06:15");
  });

  it("asks for the route, dates, currency and language", () => {
    const params = liveParams(roundTrip, "RON");
    expect(params.get("departure_id")).toBe("CRA");
    expect(params.get("arrival_id")).toBe("BGY");
    expect(params.get("outbound_date")).toBe("2026-11-12");
    expect(params.get("return_date")).toBe("2026-11-16");
    expect(params.get("currency")).toBe("RON");
    expect(params.get("hl")).toBe("ro");
    expect(liveParams({ ...roundTrip, oneWay: true }, "EUR").get("return_date")).toBeNull();
  });

  it("reads Google's own price judgement", () => {
    expect(parseInsights(fixture)).toEqual({ lowest: 478, level: "low", low: 430, high: 610 });
    expect(parseInsights({ price_insights: { typical_price_range: [400, 700] } })).toEqual({ lowest: null, level: null, low: 400, high: 700 });
    expect(parseInsights({})).toBeNull();
  });
});
