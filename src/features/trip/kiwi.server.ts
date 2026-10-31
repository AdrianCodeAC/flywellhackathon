// Live flight fares over the network from Kiwi.com's free search service.
// The parsing rules live in kiwi.ts; nothing here needs a key or an account.
import { bookingLinks, type FlightResult, type TripInput } from "./types";
import { readTripCache, writeTripCache } from "./cache.server";
import { KIWI_MCP_URL, KIWI_TTL, kiwiRequestBody, parseKiwi, readStreamJson, type KiwiPayload } from "./kiwi";

export { KIWI_TTL };



export function kiwiCacheKey(input: TripInput, currency: string) {
  return `kiwi-v1:${input.origin}:${input.destinationIata ?? input.destination}:${input.departure}:${input.oneWay ? "ow" : input.returnDate}:${input.flexible ? "f3" : "f0"}:${input.adults + input.children}:${input.direct ? "direct" : "any"}:${currency}`;
}

/** Live fares for one route and date pair, or null when the free service gives nothing usable. */
export async function kiwiFares(input: TripInput, signal: AbortSignal): Promise<FlightResult | null> {
  if (!input.destinationIata) return null;
  const currency = input.lang === "ro" ? "RON" : "EUR";
  const fetchedAt = new Date().toISOString();
  const key = kiwiCacheKey(input, currency);
  const cached = await readTripCache<FlightResult>(key, KIWI_TTL).catch(() => undefined);
  if (cached?.flights.length) return cached;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  const relay = () => controller.abort();
  signal.addEventListener("abort", relay, { once: true });
  try {
    const response = await fetch(KIWI_MCP_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: kiwiRequestBody(input, currency),
      signal: controller.signal,
    });
    console.info(`[Trip HTTP] ${new URL(KIWI_MCP_URL).hostname} status=${response.status}`);
    if (!response.ok) return null;
    const envelope = readStreamJson(await response.text()) as { result?: { content?: { text?: string }[] } } | null;
    const text = envelope?.result?.content?.[0]?.text;
    if (!text) return null;
    const payload = JSON.parse(text) as KiwiPayload;
    const flights = parseKiwi(payload, input, currency, bookingLinks(input, input.destination).google);
    const result: FlightResult = {
      flights,
      error: flights.length ? null : "noFlights",
      fetchedAt,
      baggageUnknown: input.bag,
      source: "kiwi",
    };
    if (flights.length) void writeTripCache(key, result).catch(() => {});
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    signal.removeEventListener("abort", relay);
  }
}
