/**
 * Arrival Assistant API layer. All external calls live here so other parts of the app can reuse them.
 * Implemented: airports. Others are stubs, filled in by later steps.
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

const notYet = (name: string) => (): never => {
  throw new Error(`${name} is not implemented yet`);
};

// ---- Stubs (later steps) ----
export const fetchOverpassPlaces: (lat: number, lon: number, radiusM: number, kinds: string[]) => Promise<Place[]> =
  notYet("fetchOverpassPlaces");
export const geocodeNominatim: (query: string) => Promise<Place[]> = notYet("geocodeNominatim");
export const fetchOsrmRoute: (
  from: [number, number],
  to: [number, number],
  profile?: RouteProfile,
) => Promise<Route> = notYet("fetchOsrmRoute");
export const fetchWikivoyageGetIn: (city: string) => Promise<string> = notYet("fetchWikivoyageGetIn");
export const fetchWikipediaSummary: (title: string) => Promise<string> = notYet("fetchWikipediaSummary");
export const askAI: (question: string, context: unknown) => Promise<{ text: string; places: Place[] }> =
  notYet("askAI");
