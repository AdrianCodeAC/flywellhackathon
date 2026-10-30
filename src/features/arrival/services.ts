/**
 * Arrival Assistant API layer. All external calls live here so other parts of the app can reuse them.
 * Implemented: airports, OSRM routing, Nominatim geocoding. Others are stubs, filled in by later steps.
 */
import type { Airport, Place, Route, RouteProfile } from "./types";
import { rankSights } from "./place-utils";
import { sourceCacheKey } from "./place-sources";
import { loggedFetch } from "./external-http";
import { getOverpassPlaces } from "./overpass.functions";
import { getPlaceSummaries, getTransportGuide, type TransportGuide } from "./guides.functions";
import { askAssistant, type AssistantAnswer } from "./ai.functions";
import tzLookup from "tz-lookup";
import i18n from "@/lib/i18n";

type RawAirport = [
  iata: string,
  name: string,
  city: string,
  country: string,
  lat: number,
  lon: number,
];

let airportsPromise: Promise<Airport[]> | null = null;

function countryName(code: string): string {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** Loads the bundled static airport dataset (IATA airports only). Cached after the first call. */
export function loadAirports(): Promise<Airport[]> {
  if (!airportsPromise) {
    airportsPromise = loggedFetch("/data/airports.json")
      .then((r) => {
        if (!r.ok) throw new Error(`Airport data failed: ${r.status}`);
        return r.json() as Promise<RawAirport[]>;
      })
      .then((rows) =>
        rows.map(([iata, name, city, cc, lat, lon]) => ({
          iata,
          name,
          city: city || name,
          countryCode: cc,
          country: countryName(cc),
          lat,
          lon,
        })),
      )
      .catch((e) => {
        airportsPromise = null;
        throw e;
      });
  }
  return airportsPromise;
}

export async function getAirportByIata(iata: string): Promise<Airport | undefined> {
  const code = iata.trim().toUpperCase();
  return (await loadAirports()).find((a) => a.iata === code);
}

const OSRM_HOST = "https://router.project-osrm.org";
const NOMINATIM_HOST = "https://nominatim.openstreetmap.org";

interface OsrmResponse {
  code: string;
  routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[];
}

/**
 * Drives or walks between two [lat, lon] points using the public OSRM router.
 * OSRM returns geojson [lon, lat] pairs; this converts them to [lat, lon].
 */
export async function fetchOsrmRoute(
  from: [number, number],
  to: [number, number],
  profile: RouteProfile = "driving",
): Promise<Route> {
  const url = `${OSRM_HOST}/route/v1/${profile}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`;
  const res = await loggedFetch(url);
  if (!res.ok) throw new Error(`OSRM failed: ${res.status}`);
  const data = (await res.json()) as OsrmResponse;
  const best = data.routes?.[0];
  if (data.code !== "Ok" || !best) throw new Error("OSRM returned no route");
  return {
    profile,
    distanceM: best.distance,
    durationSec: best.duration,
    coordinates: best.geometry.coordinates.map(([lon, lat]) => [lat, lon]),
  };
}

interface NominatimHit {
  name?: string;
  display_name: string;
  lat: string;
  lon: string;
  category?: string;
  type?: string;
}

// Nominatim's usage policy: at most one request per second.
let lastNominatimAt = 0;
let nominatimQueue: Promise<unknown> = Promise.resolve();

async function nominatimFetch(url: string): Promise<Response> {
  const pending = nominatimQueue
    .catch(() => {})
    .then(async () => {
      const wait = Math.max(0, 1000 - (Date.now() - lastNominatimAt));
      if (wait) await new Promise((r) => setTimeout(r, wait));
      lastNominatimAt = Date.now();
      return loggedFetch(url, { headers: { Accept: "application/json" } });
    });
  nominatimQueue = pending;
  return pending;
}

function toPlace(hit: NominatimHit, i: number): Place {
  return {
    id: `nominatim-${hit.name ?? hit.display_name}-${i}`,
    name: hit.name || hit.display_name.split(",")[0] || hit.display_name,
    kind: "other",
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    tags: { display_name: hit.display_name, category: hit.category ?? "" },
  };
}

/** Geocodes a free-text query through Nominatim (max 1 request/second). */
export async function geocodeNominatim(query: string, countryCode?: string): Promise<Place[]> {
  const cc = countryCode ? `&countrycodes=${encodeURIComponent(countryCode.toLowerCase())}` : "";
  const url = `${NOMINATIM_HOST}/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=5${cc}`;
  const res = await nominatimFetch(url);
  if (!res.ok) throw new Error(`Nominatim failed: ${res.status}`);
  const rows = (await res.json()) as NominatimHit[];
  return rows.map(toPlace);
}

/**
 * The city's own centre point. Geocoding the bare city name inside the airport's
 * country beats searching "{city} center", which matches places literally named
 * "Lisbon Center" in the United States.
 */
export async function geocodeCityCenter(
  city: string,
  countryCode?: string,
): Promise<Place | undefined> {
  const rows = await geocodeNominatim(city, countryCode);
  const best = rows.find((r) => r.tags?.["category"] === "administrative") ?? rows[0];
  return best;
}

// ---- Cache: memory + localStorage, 24h ----
const DAY_MS = 24 * 60 * 60 * 1000;
const memCache = new Map<string, { at: number; value: unknown }>();
const CACHE_PREFIX = "arrival-cache:";
const inflight = new Map<string, Promise<unknown>>();

export async function cached<T>(key: string, load: () => Promise<T>, ttlMs = DAY_MS): Promise<T> {
  const now = Date.now();
  const mem = memCache.get(key);
  if (mem && now - mem.at < ttlMs) return mem.value as T;
  try {
    const raw =
      typeof localStorage !== "undefined" ? localStorage.getItem(CACHE_PREFIX + key) : null;
    if (raw) {
      const hit = JSON.parse(raw) as { at: number; value: T };
      if (now - hit.at < ttlMs) {
        memCache.set(key, hit);
        return hit.value;
      }
      localStorage.removeItem(CACHE_PREFIX + key);
    }
  } catch {
    /* ignore bad cache entries */
  }
  // Share one in-flight request between callers asking for the same key.
  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;
  const promise = load().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  const value = await promise;
  const entry = { at: now, value };
  memCache.set(key, entry);
  try {
    localStorage.setItem(CACHE_PREFIX + key, JSON.stringify(entry));
  } catch {
    /* storage full or unavailable — memory cache still works */
  }
  return value;
}

/** Only for tests. */
export function clearMemoryCache() {
  memCache.clear();
}

/** City centre, cached per city for 24h. */
export function getCityCenter(city: string, countryCode?: string): Promise<Place | undefined> {
  return cached(`center:${countryCode ?? ""}:${city.toLowerCase()}`, () =>
    geocodeCityCenter(city, countryCode),
  );
}

export { distanceMeters } from "./place-utils";

// ---- Overpass (via backend proxy with shared 24h cache) ----
export type OverpassCategory = "food" | "sights" | "transport";

export interface PlacesResult {
  places: Place[];
  fetchedAt: number;
  /** Older copy shown because fresh data couldn't be loaded. */
  stale: boolean;
}

const OVERPASS_DEVICE_PREFIX = "arrival-overpass:";
const overpassMem = new Map<string, PlacesResult>();
const overpassInflight = new Map<string, Promise<PlacesResult>>();

function placesKey(category: OverpassCategory, lat: number, lon: number, radiusM: number, lang: string) {
  return sourceCacheKey(category, lat, lon, radiusM, lang);
}

/** Device copy (any age) for instant display; `fresh` = under 24h. */
export function peekPlaces(
  category: OverpassCategory,
  lat: number,
  lon: number,
  radiusM: number,
  lang = i18n.language,
): (PlacesResult & { fresh: boolean }) | undefined {
  const key = placesKey(category, lat, lon, radiusM, lang);
  let hit = overpassMem.get(key);
  if (!hit) {
    try {
      const raw = localStorage.getItem(OVERPASS_DEVICE_PREFIX + key);
      if (raw) {
        hit = JSON.parse(raw) as PlacesResult;
        overpassMem.set(key, hit);
      }
    } catch {
      /* ignore */
    }
  }
  return hit ? { ...hit, fresh: Date.now() - hit.fetchedAt < DAY_MS } : undefined;
}

/**
 * Places around a point. Fresh device copy → instant; otherwise asks the backend
 * (shared cache, then a race across Overpass mirrors). Concurrent calls share one request.
 */
export function fetchOverpassPlaces(
  category: OverpassCategory,
  lat: number,
  lon: number,
  radiusM: number,
  lang = i18n.language,
): Promise<PlacesResult> {
  const local = peekPlaces(category, lat, lon, radiusM, lang);
  if (local?.fresh) return Promise.resolve(local);
  const key = placesKey(category, lat, lon, radiusM, lang);
  const pending = overpassInflight.get(key);
  if (pending) return pending;
  const p = getOverpassPlaces({ data: { category, lat, lon, radiusM: Math.round(radiusM), lang: lang === "ro" ? "ro" : "en" } })
    .then((res) => {
      const value: PlacesResult = res;
      // Don't overwrite a newer device copy with an older stale server copy.
      if (!value.stale || !local || value.fetchedAt > local.fetchedAt) {
        overpassMem.set(key, value);
        try {
          localStorage.setItem(OVERPASS_DEVICE_PREFIX + key, JSON.stringify(value));
        } catch {
          /* storage full */
        }
      }
      return value.stale && local && local.fetchedAt > value.fetchedAt
        ? { ...local, stale: true }
        : value;
    })
    .finally(() => overpassInflight.delete(key));
  overpassInflight.set(key, p);
  return p;
}

export const FOOD_RADIUS = { airport: 1500, center: 1200 } as const;

/** Resolves the search point for the food list's two areas. */
export async function foodOrigin(
  airport: Airport,
  area: "airport" | "center",
): Promise<[number, number]> {
  if (area === "airport") return [airport.lat, airport.lon];
  const c = await getCityCenter(airport.city, airport.countryCode);
  if (!c) throw new Error("No city center");
  return [c.lat, c.lon];
}

/** Warm both food areas in the background as soon as an airport is chosen. */
export function prefetchFood(airport: Airport) {
  void fetchOverpassPlaces("food", airport.lat, airport.lon, FOOD_RADIUS.airport).catch(() => {});
  void foodOrigin(airport, "center")
    .then(([lat, lon]) => fetchOverpassPlaces("food", lat, lon, FOOD_RADIUS.center))
    .catch(() => {});
}
// ---- Sights (What to visit?) ----
/** 10 km around the city centre, per the spec. */
export const SIGHTS_RADIUS = 10_000;

/** Sights are searched from the city centre, not the airport. */
export async function sightsOrigin(airport: Airport): Promise<[number, number]> {
  const c = await getCityCenter(airport.city, airport.countryCode);
  if (!c) throw new Error("No city center");
  return [c.lat, c.lon];
}

/**
 * Summaries for the places that carry a wikipedia/wikidata tag, in the reader's
 * language. Cached per language + set of places.
 */
export function fetchSummaries(
  items: { id: string; wikipedia?: string; wikidata?: string }[],
  lang: string,
): Promise<Record<string, string>> {
  const usable = items.filter((i) => i.wikipedia || i.wikidata);
  if (usable.length === 0) return Promise.resolve({});
  const key = `sum:${lang}:${usable
    .map((i) => i.id)
    .sort()
    .join("|")}`;
  return cached(key, () =>
    getPlaceSummaries({ data: { items: usable.slice(0, 10), lang: lang === "ro" ? "ro" : "en" } }),
  );
}

/** Warm the sights list and their summaries in the background. */
export function prefetchSights(airport: Airport) {
  void sightsOrigin(airport)
    .then(([lat, lon]) => fetchOverpassPlaces("sights", lat, lon, SIGHTS_RADIUS, i18n.language))
    .catch(() => {});
}

// ---- Transport (Need a ride?) ----
/** Stations and bus stops around the airport. */
export const STATION_RADIUS = 1_500;

export function nearbyStations(airport: Airport): Promise<PlacesResult> {
  return fetchOverpassPlaces("transport", airport.lat, airport.lon, STATION_RADIUS);
}

/** The city's airport-arrival advice, in the reader's language. */
export function transportGuide(city: string, lang: string): Promise<TransportGuide> {
  return cached(`guide:${lang}:${city.toLowerCase()}`, () =>
    getTransportGuide({ data: { city, lang: lang === "ro" ? "ro" : "en" } }),
  );
}

// ---- Ask anything (AI) ----
export interface AssistantContext {
  airport: Airport;
  lang: string;
  food?: Place[];
  sights?: Place[];
  stations?: Place[];
}

/** Destination clock with the airport's IANA time zone, including daylight saving. */
export function destinationClock(lon: number, date = new Date(), lat = 0): string {
  const timeZone = tzLookup(lat, lon);
  return `${new Intl.DateTimeFormat("en-GB", { weekday: "long", hour: "2-digit", minute: "2-digit", timeZone }).format(date)} (${timeZone})`;
}

function contextLine(p: Place): string {
  const bits = [p.name, `lat=${p.lat}`, `lon=${p.lon}`];
  if (p.kind !== "other") bits.push(p.kind);
  if (p.distance !== undefined) bits.push(`${Math.round(p.distance / 100) / 10} km away`);
  if (p.cuisine) bits.push(p.cuisine);
  if (p.openingHours) bits.push(`hours: ${p.openingHours}`);
  return `- ${bits.join(", ")}`;
}

/** Plain-text brief handed to the AI function with every question. */
export function buildAssistantContext(ctx: AssistantContext): string {
  const lines = [
    `Airport: ${ctx.airport.iata} — ${ctx.airport.name}, ${ctx.airport.city}, ${ctx.airport.country}`,
    `Airport coordinates: lat=${ctx.airport.lat}, lon=${ctx.airport.lon}`,
    `Local time at the destination: ${destinationClock(ctx.airport.lon, new Date(), ctx.airport.lat)}`,
    `Answer language: ${ctx.lang === "ro" ? "Romanian" : "English"}`,
  ];
  const section = (title: string, places?: Place[]) => {
    if (!places || places.length === 0) return;
    lines.push("", `${title}:`, ...places.slice(0, 15).map(contextLine));
  };
  section("Food already found", ctx.food);
  section("Sights already found", ctx.sights);
  section("Stations and stops near the airport", ctx.stations);
  return lines.join("\n");
}

/** Ask the assistant. Only ever called through the backend function. */
export function askAI(
  question: string,
  history: { role: "user" | "assistant"; content: string }[],
  context: string,
  lang: string,
): Promise<AssistantAnswer> {
  return askAssistant({
    data: { question, history, lang: lang === "ro" ? "ro" : "en", context },
  });
}
