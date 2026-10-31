// Live flight fares over the network. The parsing rules live in live.ts.
import { bookingLinks, type FlightResult, type TripInput } from "./types";
import { readTripCache, writeTripCache } from "./cache.server";
import { LIVE_TTL, liveParams, parseInsights, parseLiveFares, type LivePayload } from "./live";

export { LIVE_TTL };

export type LiveSource = { base: string; key: string; deepSearch: boolean };

/** SearchApi first: its free tier needs no card. SerpApi returns the same data shape. */
export function liveSource(): LiveSource | null {
  const search = process.env["SEARCHAPI_KEY"];
  if (search) return { base: "https://www.searchapi.io/api/v1/search", key: search, deepSearch: false };
  const serp = process.env["SERPAPI_KEY"];
  if (serp) return { base: "https://serpapi.com/search", key: serp, deepSearch: true };
  return null;
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
    const response = await fetch(`${source.base}?${params}`, { signal: timeout.signal, headers: { Accept: "application/json" } });
    // Only host and status are logged: the provider key stays out of the logs.
    console.info(`[Trip HTTP] ${new URL(source.base).hostname} status=${response.status}`);
    if (!response.ok) return null;
    const payload = (await response.json()) as LivePayload;
    const flights = parseLiveFares(payload, input, currency, bookingLinks(input, input.destination).google);
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
