// Live flight fares. Google Flights has no public API of its own, so the fares
// here come from a hosted provider that reads the live Google Flights results.
// Without a provider key the planner falls back to the cached Travelpayouts fares.
import { bookingLinks, comfortScore, type Flight, type FlightResult, type TripInput } from "./types";
import { readTripCache, writeTripCache } from "./cache.server";

/** Live fares move minute to minute: keep one only long enough to re-open a result. */
export const LIVE_TTL = 10 * 60 * 1000;

type AirportTime = { name?: string; id?: string; time?: string };
type Leg = { departure_airport?: AirportTime; arrival_airport?: AirportTime; duration?: number; airline?: string; flight_number?: string };
type Offer = { flights?: Leg[]; layovers?: { duration?: number; name?: string }[]; total_duration?: number; price?: number; type?: string };
type Payload = {
  best_flights?: Offer[];
  other_flights?: Offer[];
  search_metadata?: { google_flights_url?: string; status?: string };
  price_insights?: { lowest_price?: number; price_level?: string; typical_price_range?: number[] | { low_price?: number; high_price?: number } };
};

export type LiveSource = { base: string; key: string; deepSearch: boolean };

/** SearchApi first: its free tier needs no card. SerpApi is the same data shape. */
export function liveSource(): LiveSource | null {
  const search = process.env["SEARCHAPI_KEY"];
  if (search) return { base: "https://www.searchapi.io/api/v1/search", key: search, deepSearch: false };
  const serp = process.env["SERPAPI_KEY"];
  if (serp) return { base: "https://serpapi.com/search", key: serp, deepSearch: true };
  return null;
}

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

function isoTime(time: string | undefined) {
  return time && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(time) ? time.replace(" ", "T") : null;
}

export function parseLiveFares(payload: Payload, input: TripInput, currency: string, link: string): Flight[] {
  const offers = [...(payload.best_flights ?? []), ...(payload.other_flights ?? [])];
  const found: Flight[] = [];
  for (const offer of offers) {
    const legs = offer.flights ?? [];
    if (!legs.length) continue;
    const first = legs[0];
    const last = legs[legs.length - 1];
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

export function parseInsights(payload: Payload) {
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

function withTimeout(signal: AbortSignal, ms: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const relay = () => controller.abort();
  signal.addEventListener("abort", relay, { once: true });
  return { signal: controller.signal, done: () => { clearTimeout(timer); signal.removeEventListener("abort", relay); } };
}

/** Live fares for one route and date pair, or null when no provider is configured. */
export async function liveFares(input: TripInput, signal: AbortSignal): Promise<FlightResult | null> {
  const source = liveSource();
  const fetchedAt = new Date().toISOString();
  if (!source || !input.destinationIata) return null;
  const currency = input.lang === "ro" ? "RON" : "EUR";
  const key = `live-v1:${input.origin}:${input.destinationIata}:${input.departure}:${input.oneWay ? "ow" : input.returnDate}:${currency}`;
  const cached = await readTripCache<FlightResult>(key, LIVE_TTL).catch(() => undefined);
  if (cached?.flights.length) return cached;
  const params = liveParams(input, currency);
  params.set("api_key", source.key);
  if (source.deepSearch) params.set("deep_search", "true");
  const timeout = withTimeout(signal, 15000);
  try {
    const response = await fetch(`${source.base}?${params}`, {
      signal: timeout.signal,
      headers: { Accept: "application/json" },
    });
    // Only the host and status are logged: the key stays in the query string.
    console.info(`[Trip HTTP] ${new URL(source.base).hostname} status=${response.status}`);
    if (!response.ok) return null;
    const payload = (await response.json()) as Payload;
    const link = payload.search_metadata?.google_flights_url ?? bookingLinks(input, input.destination).google;
    const flights = parseLiveFares(payload, input, currency, link);
    const result: FlightResult = {
      flights,
      error: flights.length ? null : "noFlights",
      fetchedAt,
      baggageUnknown: input.bag,
      source: "live",
      insights: parseInsights(payload),
    };
    if (flights.length) void writeTripCache(key, result).catch(() => {});
    return result;
  } catch {
    return null;
  } finally {
    timeout.done();
  }
}
