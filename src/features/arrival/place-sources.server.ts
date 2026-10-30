import { loggedFetch } from "./external-http";
import { categorizeSight, FOOD_CATEGORIES, foodSearchUrl, mergeSightLanguages, parseFoodHits, type FoodHit } from "./place-sources";
import { distanceMeters } from "./place-utils";
import { searchPlaces as overpassSearch } from "./overpass.server";
import type { Place } from "./types";

const USER_AGENT = "ArrivalAssistant/1.0 (+https://id-preview--81aa245e-d328-43c6-a930-732c5b1275d4.lovable.app; airport travel helper)";
const REFERER = "https://id-preview--81aa245e-d328-43c6-a930-732c5b1275d4.lovable.app/arrival";
let nominatimTail: Promise<unknown> = Promise.resolve();
let lastNominatim = 0;

function nominatimQueued(url: string): Promise<Response> {
  const next = nominatimTail.catch(() => undefined).then(async () => {
    const wait = Math.max(0, 1000 - (Date.now() - lastNominatim));
    if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
    lastNominatim = Date.now();
    return loggedFetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT, Referer: REFERER }, signal: AbortSignal.timeout(10_000) });
  });
  nominatimTail = next;
  return next;
}

async function nominatimFood(lat: number, lon: number, radiusM: number): Promise<Place[]> {
  const places = new Map<string, Place>();
  for (const category of FOOD_CATEGORIES) {
    const res = await nominatimQueued(foodSearchUrl(category, lat, lon, radiusM));
    if (!res.ok) throw new Error(`Nominatim ${category}: ${res.status}`);
    const rows = await res.json() as unknown;
    if (!Array.isArray(rows)) throw new Error(`Nominatim ${category}: invalid response`);
    parseFoodHits(rows as FoodHit[], category, lat, lon).forEach((p) => places.set(p.id, p));
  }
  return [...places.values()].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

interface GeoRow { pageid: number; title: string; lat: number; lon: number; dist?: number }
interface PageRow { pageid: number; title: string; extract?: string; pageprops?: { wikibase_item?: string }; thumbnail?: { source?: string } }
async function wikiJson(url: string): Promise<unknown> {
  const res = await loggedFetch(url, { headers: { Accept: "application/json", "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(8_000) });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  return res.json();
}

async function wikipediaSights(lang: "ro" | "en", lat: number, lon: number, radiusM: number): Promise<Place[]> {
  const host = `https://${lang}.wikipedia.org/w/api.php`;
  const geo = await wikiJson(`${host}?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=${radiusM}&gslimit=50&format=json&origin=*`) as { query?: { geosearch?: GeoRow[] } };
  const rows = geo.query?.geosearch ?? [];
  if (!rows.length) return [];
  const details = await wikiJson(`${host}?action=query&prop=extracts%7Cpageimages%7Cpageprops&exintro=1&explaintext=1&exsentences=2&pithumbsize=200&pilimit=50&exlimit=50&pageids=${rows.map((r) => r.pageid).join("%7C")}&format=json&origin=*`) as { query?: { pages?: Record<string, PageRow> } };
  const pages = details.query?.pages ?? {};
  return rows.map((row) => {
    const page = pages[String(row.pageid)];
    const description = page?.extract?.trim();
    return { id: `wiki:${lang}:${row.pageid}`, name: row.title, kind: categorizeSight(row.title, description), lat: row.lat, lon: row.lon, distance: Math.round(row.dist ?? distanceMeters([lat, lon], [row.lat, row.lon])), ...(description ? { description } : {}), ...(page?.thumbnail?.source ? { thumbnail: page.thumbnail.source } : {}), ...(page?.pageprops?.wikibase_item ? { wikidata: page.pageprops.wikibase_item } : {}), articleUrl: `https://${lang}.wikipedia.org/?curid=${row.pageid}` } satisfies Place;
  });
}

async function overpassFallback(category: "food" | "sights" | "transport", lat: number, lon: number, radiusM: number): Promise<Place[]> {
  console.warn(`[Arrival source] Overpass fallback category=${category}`);
  return (await overpassSearch(category, lat, lon, radiusM, (url, init) => loggedFetch(String(url), init), 8_000)).places;
}

export async function searchArrivalPlaces(category: "food" | "sights" | "transport", lat: number, lon: number, radiusM: number, lang: "ro" | "en"): Promise<Place[]> {
  if (category === "transport") return overpassFallback(category, lat, lon, radiusM);
  try {
    if (category === "food") return await nominatimFood(lat, lon, radiusM);
    const primary = await wikipediaSights(lang, lat, lon, radiusM);
    return lang === "ro" && primary.length < 10 ? mergeSightLanguages(primary, await wikipediaSights("en", lat, lon, radiusM)) : primary;
  } catch (error) {
    console.error(`[Arrival source] primary failed category=${category}`, error);
    return overpassFallback(category, lat, lon, radiusM);
  }
}