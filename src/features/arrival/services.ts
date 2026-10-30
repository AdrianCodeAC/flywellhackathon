/**
 * Arrival Assistant API layer. All external calls live here so other parts of the app can reuse them.
 * Implemented: airports, OSRM routing, Nominatim geocoding. Others are stubs, filled in by later steps.
 */
import type { Airport, Place, Route, RouteProfile } from "./types";

type RawAirport = [iata: string, name: string, city: string, country: string, lat: number, lon: number];

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
    airportsPromise = fetch("/data/airports.json")
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
  const res = await fetch(url);
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

async function nominatimFetch(url: string): Promise<Response> {
  const wait = Math.max(0, 1000 - (Date.now() - lastNominatimAt));
  if (wait) await new Promise((r) => setTimeout(r, wait));
  lastNominatimAt = Date.now();
  // The browser sends Referer automatically, which is what Nominatim identifies us by.
  return fetch(url, { headers: { Accept: "application/json" } });
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
export async function geocodeCityCenter(city: string, countryCode?: string): Promise<Place | undefined> {
  const rows = await geocodeNominatim(city, countryCode);
  const best = rows.find((r) => r.tags?.["category"] === "administrative") ?? rows[0];
  return best;
}


// ---- Cache: memory + localStorage, 24h ----
const DAY_MS = 24 * 60 * 60 * 1000;
const memCache = new Map<string, { at: number; value: unknown }>();
const CACHE_PREFIX = "arrival-cache:";

export async function cached<T>(key: string, load: () => Promise<T>, ttlMs = DAY_MS): Promise<T> {
  const now = Date.now();
  const mem = memCache.get(key);
  if (mem && now - mem.at < ttlMs) return mem.value as T;
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(CACHE_PREFIX + key) : null;
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
  const value = await load();
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
  return cached(`center:${countryCode ?? ""}:${city.toLowerCase()}`, () => geocodeCityCenter(city, countryCode));
}

export function distanceMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

const OVERPASS_HOST = "https://overpass-api.de/api/interpreter";

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

function kindFromTags(t: Record<string, string>): Place["kind"] {
  const a = t["amenity"];
  if (a === "restaurant" || a === "fast_food" || a === "cafe") return a;
  if (t["tourism"] === "museum") return "museum";
  if (t["tourism"] === "gallery") return "gallery";
  if (t["tourism"] === "viewpoint") return "viewpoint";
  if (t["tourism"] === "attraction") return "attraction";
  if (t["historic"] === "castle") return "castle";
  if (t["historic"] === "monument") return "monument";
  if (t["railway"] === "station" || t["public_transport"] === "station") return "station";
  if (t["highway"] === "bus_stop") return "bus_stop";
  return "other";
}

/**
 * Queries Overpass for named places around a point.
 * `selectors` are Overpass tag filters, e.g. `["amenity"~"^(restaurant|cafe)$"]`.
 * Results are sorted by distance and cached for 24h.
 */
export function fetchOverpassPlaces(
  lat: number,
  lon: number,
  radiusM: number,
  selectors: string[],
): Promise<Place[]> {
  const key = `overpass:${lat.toFixed(3)},${lon.toFixed(3)}:${radiusM}:${selectors.join("|")}`;
  return cached(key, async () => {
    const body = selectors.map((s) => `nwr${s}["name"](around:${radiusM},${lat},${lon});`).join("");
    const query = `[out:json][timeout:25];(${body});out center tags 300;`;
    const res = await fetch(OVERPASS_HOST, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });
    if (!res.ok) throw new Error(`Overpass failed: ${res.status}`);
    const data = (await res.json()) as { elements?: OverpassElement[] };
    const places: Place[] = [];
    for (const el of data.elements ?? []) {
      const pLat = el.lat ?? el.center?.lat;
      const pLon = el.lon ?? el.center?.lon;
      const tags = el.tags ?? {};
      const name = tags["name:en"] || tags["name"];
      if (pLat === undefined || pLon === undefined || !name) continue;
      places.push({
        id: `${el.type}/${el.id}`,
        name,
        kind: kindFromTags(tags),
        lat: pLat,
        lon: pLon,
        distance: distanceMeters([lat, lon], [pLat, pLon]),
        cuisine: tags["cuisine"]?.split(";").map((c) => c.trim().replace(/_/g, " ")).join(", "),
        openingHours: tags["opening_hours"],
        wikipedia: tags["wikipedia"],
        wikidata: tags["wikidata"],
        tags,
      });
    }
    return places.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
  });
}

export const FOOD_SELECTORS = ['["amenity"~"^(restaurant|fast_food|cafe)$"]'];

const notYet = (name: string) => (): never => {
  throw new Error(`${name} is not implemented yet`);
};

// ---- Stubs (later steps) ----
export const fetchWikivoyageGetIn: (city: string) => Promise<string> = notYet("fetchWikivoyageGetIn");
export const fetchWikipediaSummary: (title: string) => Promise<string> = notYet("fetchWikipediaSummary");
export const askAI: (question: string, context: unknown) => Promise<{ text: string; places: Place[] }> =
  notYet("askAI");
