/**
 * Server-only Overpass logic: whitelisted categories, a light query, and a race
 * across public mirrors (first success wins, others are aborted).
 */
import type { Place } from "./types";
import { distanceMeters, kindFromTags } from "./place-utils";

export type OverpassCategory = "food" | "sights" | "transport";

export const OVERPASS_MIRRORS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
];

const MIRROR_TIMEOUT_MS = 12_000;
export const MIN_RESULTS = 8;

/** Tag filters per category — the browser can only pick a category, never send raw queries. */
const FILTERS: Record<OverpassCategory, string[]> = {
  food: ['["amenity"~"^(restaurant|fast_food|cafe)$"]'],
  sights: [
    '["tourism"~"^(museum|attraction|viewpoint|gallery)$"]',
    '["historic"~"^(monument|castle)$"]',
  ],
  transport: ['["public_transport"="station"]', '["railway"="station"]', '["highway"="bus_stop"]'],
};

/** Only the tags the app displays. */
const KEEP_TAGS = [
  "name",
  "name:en",
  "amenity",
  "cuisine",
  "opening_hours",
  "phone",
  "contact:phone",
  "tourism",
  "historic",
  "railway",
  "public_transport",
  "highway",
  "wikipedia",
  "wikidata",
];

export function buildOverpassQuery(category: OverpassCategory, lat: number, lon: number, radiusM: number): string {
  const around = `(around:${Math.round(radiusM)},${lat.toFixed(5)},${lon.toFixed(5)})`;
  const parts = FILTERS[category].flatMap((f) => [`node${f}["name"]${around};`, `way${f}["name"]${around};`]);
  return `[out:json][timeout:12];(${parts.join("")});out center tags 60;`;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function parseOverpass(elements: OverpassElement[], lat: number, lon: number): Place[] {
  const out: Place[] = [];
  for (const el of elements) {
    const pLat = el.lat ?? el.center?.lat;
    const pLon = el.lon ?? el.center?.lon;
    const all = el.tags ?? {};
    const name = all["name:en"] || all["name"];
    if (pLat === undefined || pLon === undefined || !name) continue;
    const tags: Record<string, string> = {};
    for (const k of KEEP_TAGS) if (all[k]) tags[k] = all[k];
    const place: Place = {
      id: `${el.type}/${el.id}`,
      name,
      kind: kindFromTags(tags),
      lat: pLat,
      lon: pLon,
      distance: Math.round(distanceMeters([lat, lon], [pLat, pLon])),
      tags,
    };
    if (tags["cuisine"]) place.cuisine = tags["cuisine"].split(";").map((c) => c.trim().replace(/_/g, " ")).join(", ");
    if (tags["opening_hours"]) place.openingHours = tags["opening_hours"];
    const phone = (tags["phone"] || tags["contact:phone"])?.split(";")[0]?.trim();
    if (phone) place.phone = phone;
    if (tags["wikipedia"]) place.wikipedia = tags["wikipedia"];
    if (tags["wikidata"]) place.wikidata = tags["wikidata"];
    out.push(place);
  }
  return out.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

/** Sends the query to every mirror at once; resolves with the first good answer and aborts the rest. */
export async function raceMirrors(
  query: string,
  fetchImpl: typeof fetch = fetch,
  mirrors = OVERPASS_MIRRORS,
  timeoutMs = MIRROR_TIMEOUT_MS,
): Promise<OverpassElement[]> {
  const controllers = mirrors.map(() => new AbortController());
  const timers = controllers.map((c) => setTimeout(() => c.abort(), timeoutMs));
  try {
    return await Promise.any(
      mirrors.map(async (url, i) => {
        const res = await fetchImpl(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "ArrivalAssistant/1.0 (travel helper web app)",
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: controllers[i]!.signal,
        });
        if (!res.ok) throw new Error(`${url} ${res.status}`);
        const data = (await res.json()) as { elements?: OverpassElement[]; remark?: string };
        if (!Array.isArray(data.elements)) throw new Error(`${url} bad body`);
        // A timeout inside Overpass comes back as 200 with a "remark" and partial data.
        if (data.remark && /timed out|runtime error/i.test(data.remark) && data.elements.length === 0) {
          throw new Error(`${url} ${data.remark}`);
        }
        controllers.forEach((c, j) => j !== i && c.abort());
        return data.elements;
      }),
    );
  } finally {
    timers.forEach(clearTimeout);
  }
}

/** Query once; if too few results, retry once with double the radius. */
export async function searchPlaces(
  category: OverpassCategory,
  lat: number,
  lon: number,
  radiusM: number,
  fetchImpl: typeof fetch = fetch,
): Promise<{ places: Place[]; radiusM: number }> {
  let places = parseOverpass(await raceMirrors(buildOverpassQuery(category, lat, lon, radiusM), fetchImpl), lat, lon);
  if (places.length < MIN_RESULTS) {
    const wider = radiusM * 2;
    places = parseOverpass(await raceMirrors(buildOverpassQuery(category, lat, lon, wider), fetchImpl), lat, lon);
    return { places, radiusM: wider };
  }
  return { places, radiusM };
}
