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

/** Geocodes a free-text query through Nominatim (max 1 request/second). */
export async function geocodeNominatim(query: string): Promise<Place[]> {
  const url = `${NOMINATIM_HOST}/search?q=${encodeURIComponent(query)}&format=jsonv2&limit=5`;
  const res = await nominatimFetch(url);
  if (!res.ok) throw new Error(`Nominatim failed: ${res.status}`);
  const rows = (await res.json()) as NominatimHit[];
  return rows.map((hit, i) => ({
    id: `nominatim-${hit.name ?? hit.display_name}-${i}`,
    name: hit.name || hit.display_name.split(",")[0],
    kind: "other" as const,
    lat: Number(hit.lat),
    lon: Number(hit.lon),
    tags: { display_name: hit.display_name },
  }));
}

const notYet = (name: string) => (): never => {
  throw new Error(`${name} is not implemented yet`);
};

// ---- Stubs (later steps) ----
export const fetchOverpassPlaces: (lat: number, lon: number, radiusM: number, kinds: string[]) => Promise<Place[]> =
  notYet("fetchOverpassPlaces");
export const fetchWikivoyageGetIn: (city: string) => Promise<string> = notYet("fetchWikivoyageGetIn");
export const fetchWikipediaSummary: (title: string) => Promise<string> = notYet("fetchWikipediaSummary");
export const askAI: (question: string, context: unknown) => Promise<{ text: string; places: Place[] }> =
  notYet("askAI");
