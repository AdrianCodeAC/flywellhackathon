// Pure live-fare helpers: no network, no keys, safe to test and to import anywhere.
// Google Flights has no public API of its own, so live fares come from a hosted
// provider that reads the live Google Flights results (see live.server.ts).
import { comfortScore, type Flight, type TripInput } from "./types";

/** Live fares move minute to minute: keep one only long enough to re-open a result. */
export const LIVE_TTL = 10 * 60 * 1000;

export type AirportTime = { name?: string; id?: string; time?: string };
export type Leg = { departure_airport?: AirportTime; arrival_airport?: AirportTime; duration?: number; airline?: string; flight_number?: string };
export type Offer = { flights?: Leg[]; layovers?: { duration?: number; name?: string }[]; total_duration?: number; price?: number; type?: string };
export type LivePayload = {
  best_flights?: Offer[];
  other_flights?: Offer[];
  search_metadata?: { google_flights_url?: string; status?: string };
  price_insights?: { lowest_price?: number; price_level?: string; typical_price_range?: number[] | { low_price?: number; high_price?: number } };
};

/** One adult: the price then means "per person", like the cached fares do. */
export function liveParams(input: TripInput, currency: string) {
  const params = new URLSearchParams({
    engine: "google_flights",
    departure_id: input.origin,
    arrival_id: input.destinationIata ?? "",
    outbound_date: input.departure.slice(0, 10),
    travel_class: "economy",
    currency,
    hl: input.lang,
    gl: "ro",
  });
  if (!input.oneWay) params.set("return_date", input.returnDate.slice(0, 10));
  return params;
}

export function isoTime(time: string | undefined) {
  return time && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(time) ? time.replace(" ", "T") : null;
}

export function parseLiveFares(payload: LivePayload, input: TripInput, currency: string, link: string): Flight[] {
  const offers = [...(payload.best_flights ?? []), ...(payload.other_flights ?? [])];
  const found: Flight[] = [];
  for (const offer of offers) {
    const legs = offer.flights ?? [];
    if (!legs.length) continue;
    const first = legs[0];
    const last = legs[legs.length - 1];
    if (!first || !last) continue;
    const departure = isoTime(first.departure_airport?.time);
    const price = Number(offer.price);
    if (!departure || !(price > 0)) continue;
    const flightNumber = legs.map((leg) => leg.flight_number).filter(Boolean).join(" + ") || null;
    const flight: Flight = {
      id: `live:${flightNumber ?? first.airline ?? ""}:${departure}`,
      airline: first.airline ?? "",
      departure,
      // Google prices the whole round trip, so the return date is the one requested.
      returnDate: input.oneWay ? departure : input.returnDate.slice(0, 10),
      price,
      stops: Math.max(0, legs.length - 1),
      duration: typeof offer.total_duration === "number" ? offer.total_duration : null,
      layover: offer.layovers?.[0]?.duration ?? null,
      arrival: isoTime(last.arrival_airport?.time),
      score: 0,
      link,
      currency,
      flightNumber,
      live: true,
    };
    flight.score = comfortScore(flight);
    if (!found.some((existing) => existing.id === flight.id)) found.push(flight);
  }
  return found.sort((a, b) => a.price - b.price).slice(0, 12);
}

export function parseInsights(payload: LivePayload) {
  const insights = payload.price_insights;
  if (!insights) return null;
  const band = Array.isArray(insights.typical_price_range)
    ? insights.typical_price_range
    : insights.typical_price_range
      ? [insights.typical_price_range.low_price, insights.typical_price_range.high_price]
      : null;
  return {
    lowest: Number.isFinite(insights.lowest_price) ? Number(insights.lowest_price) : null,
    level: insights.price_level ?? null,
    low: band?.[0] ?? null,
    high: band?.[1] ?? null,
  };
}
