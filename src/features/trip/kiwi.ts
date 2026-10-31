// Pure Kiwi.com search helpers: no network, no keys, safe to import anywhere.
// Kiwi publishes a free flight-search service (no login, no API key) that returns
// real bookable itineraries; the network call lives in kiwi.server.ts.
import { comfortScore, dateMatches, type Flight, type TripInput } from "./types";

export const KIWI_MCP_URL = "https://mcp.kiwi.com/";
/** Live fares move minute to minute: keep one only long enough to re-open a result. */
export const KIWI_TTL = 10 * 60 * 1000;

export type KiwiSegment = {
  from?: string; to?: string; fromCity?: string; toCity?: string;
  departureTime?: string; arrivalTime?: string; durationSeconds?: number;
  carrier?: string; carrierName?: string; flightNumber?: string;
};
export type KiwiLeg = {
  from?: string; to?: string; departureTime?: string; arrivalTime?: string;
  durationSeconds?: number; stops?: number; route?: string[];
  cabinClass?: string; segments?: KiwiSegment[];
};
export type KiwiItinerary = {
  id?: string; price?: number; priceFormatted?: string; totalDurationSeconds?: number;
  bookingUrl?: string | undefined; imageId?: string;
  baggage?: { personalItem?: number; cabinBag?: number; checkedBag?: number };
  outbound?: KiwiLeg | undefined; inbound?: KiwiLeg | undefined;
};
export type KiwiArgs = {
  flyFrom: string; flyTo: string; departureDate: string; adults: number; children: number;
  currency: string; sort: string;
  departureDateFlexDays?: number; returnDate?: string; returnDateFlexDays?: number; max_sector_stopovers?: number;
};
export type KiwiPayload = { currency?: string; resultsCount?: number; itineraries?: KiwiItinerary[] };

/** The service answers as a stream: pull the single JSON line out of it. */
export function readStreamJson(text: string): unknown {
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    try { return JSON.parse(trimmed.slice(5).trim()); } catch { /* keep scanning */ }
  }
  try { return JSON.parse(text); } catch { return null; }
}

/** Kiwi wants dd/mm/yyyy and its own spelling of the options the traveller picked. */
export function kiwiArgs(input: TripInput, currency: string): KiwiArgs {
  const day = (value: string) => `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}`;
  const args: KiwiArgs = {
    flyFrom: input.origin,
    flyTo: input.destinationIata ?? input.destination,
    departureDate: day(input.departure),
    adults: input.adults,
    children: input.children,
    currency,
    sort: "price",
  };
  if (input.flexible) args.departureDateFlexDays = 3;
  if (!input.oneWay) {
    args.returnDate = day(input.returnDate);
    if (input.flexible) args.returnDateFlexDays = 3;
  }
  if (input.direct) args.max_sector_stopovers = 0;
  return args;
}

/** The whole request body the free service expects for this trip. */
export function kiwiRequestBody(input: TripInput, currency: string) {
  return JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "search-flight", arguments: kiwiArgs(input, currency) } });
}

/** "2026-11-12T06:15:00" -> "2026-11-12T06:15"; anything else is not a time we can show. */
export function kiwiTime(value: string | undefined) {
  return value && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(value) ? value.slice(0, 16) : null;
}

function legStops(leg: KiwiLeg | undefined) {
  const segments = leg?.segments?.length ?? 0;
  return leg?.stops ?? Math.max(0, segments - 1);
}

/** Longest wait between two outbound flights, in minutes: what comfortScore penalises. */
function longestLayover(segments: KiwiSegment[] | undefined) {
  let longest: number | null = null;
  for (let i = 1; i < (segments?.length ?? 0); i += 1) {
    const from = Date.parse(segments?.[i - 1]?.arrivalTime ?? "");
    const to = Date.parse(segments?.[i]?.departureTime ?? "");
    if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) continue;
    const gap = Math.round((to - from) / 60000);
    if (longest === null || gap > longest) longest = gap;
  }
  return longest;
}

/**
 * Kiwi prices the whole party, while the planner shows a per-person price and
 * multiplies it back out for the total: divide the total by the traveller count.
 * Rows outside the requested dates, without a fare, or with a stopover the
 * traveller refused are dropped instead of being shown as a flight.
 */
export function parseKiwi(payload: KiwiPayload, input: TripInput, currency: string, fallbackLink: string): Flight[] {
  const people = Math.max(1, input.adults + input.children);
  const found: Flight[] = [];
  for (const itinerary of payload.itineraries ?? []) {
    const outbound = itinerary.outbound;
    const inbound = input.oneWay ? undefined : itinerary.inbound;
    const total = Number(itinerary.price);
    const departure = kiwiTime(outbound?.departureTime);
    const arrival = kiwiTime(outbound?.arrivalTime);
    const returnDate = kiwiTime(inbound?.departureTime);
    if (!departure || !(total > 0)) continue;
    if (!dateMatches(departure.slice(0, 10), input.departure, input.flexible)) continue;
    if (!input.oneWay && (!returnDate || !dateMatches(returnDate.slice(0, 10), input.returnDate, input.flexible))) continue;
    const stops = legStops(outbound) + legStops(inbound);
    if (input.direct && stops > 0) continue;
    const segments = [...(outbound?.segments ?? []), ...(inbound?.segments ?? [])];
    const airlines = [...new Set(segments.map((s) => s.carrierName).filter((name): name is string => Boolean(name)))];
    const flightNumber = segments.map((s) => s.flightNumber).filter(Boolean).join(" + ") || null;
    const seconds = typeof itinerary.totalDurationSeconds === "number" && itinerary.totalDurationSeconds > 0
      ? itinerary.totalDurationSeconds
      : (outbound?.durationSeconds ?? 0) + (inbound?.durationSeconds ?? 0);
    const flight: Flight = {
      id: `kiwi:${itinerary.id ?? `${departure}${returnDate ?? ""}`}`,
      airline: airlines.join(" + "),
      departure,
      // Round trips carry the real return time; one-way trips repeat the departure.
      returnDate: returnDate ?? departure,
      price: Math.round(total / people),
      stops,
      duration: seconds > 0 ? Math.round(seconds / 60) : null,
      layover: longestLayover(outbound?.segments),
      arrival,
      score: 0,
      link: itinerary.bookingUrl?.startsWith("https://") ? itinerary.bookingUrl : fallbackLink,
      currency: String(payload.currency ?? currency).toUpperCase(),
      flightNumber,
      live: true,
    };
    if (!flight.airline) continue;
    flight.score = comfortScore(flight);
    if (!found.some((existing) => existing.id === flight.id)) found.push(flight);
  }
  return found.sort((a, b) => a.price - b.price).slice(0, 12);
}
