import { loggedFetch } from "./external-http";
import {
  categorizeSight,
  FOOD_CATEGORIES,
  kindFromWikidataTypes,
  sightsSparql,
  widerFoodRadius,
  foodSearchUrl,
  mergeSightLanguages,
  parseFoodHits,
  type FoodHit,
} from "./place-sources";
import { distanceMeters } from "./place-utils";
import { searchPlaces as overpassSearch } from "./overpass.server";
import type { Place } from "./types";

const USER_AGENT =
  "ArrivalAssistant/1.0 (+https://id-preview--81aa245e-d328-43c6-a930-732c5b1275d4.lovable.app; airport travel helper)";
const REFERER = "https://id-preview--81aa245e-d328-43c6-a930-732c5b1275d4.lovable.app/arrival";
let nominatimTail: Promise<unknown> = Promise.resolve();
let lastNominatim = 0;

export function nominatimQueued(url: string): Promise<Response> {
  const next = nominatimTail
    .catch(() => undefined)
    .then(async () => {
      const wait = Math.max(0, 1000 - (Date.now() - lastNominatim));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      lastNominatim = Date.now();
      return loggedFetch(url, {
        headers: { Accept: "application/json", "User-Agent": USER_AGENT, Referer: REFERER },
        signal: AbortSignal.timeout(10_000),
      });
    });
  nominatimTail = next;
  return next;
}

async function nominatimFood(lat: number, lon: number, radiusM: number): Promise<Place[]> {
  const places = new Map<string, Place>();
  const search = async (radius: number) => {
    for (const category of FOOD_CATEGORIES) {
      const res = await nominatimQueued(foodSearchUrl(category, lat, lon, radius));
      if (!res.ok) throw new Error(`Nominatim ${category}: ${res.status}`);
      const rows = (await res.json()) as unknown;
      if (!Array.isArray(rows)) throw new Error(`Nominatim ${category}: invalid response`);
      parseFoodHits(rows as FoodHit[], category, lat, lon).forEach((p) => places.set(p.id, p));
    }
  };
  await search(radiusM);
  // Airports sit in the middle of runways: widen once when the first box is nearly empty.
  const wider = widerFoodRadius(radiusM, places.size);
  if (wider) await search(wider);
  return [...places.values()].sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

interface GeoRow {
  pageid: number;
  title: string;
  lat: number;
  lon: number;
  dist?: number;
}
interface PageRow {
  pageid: number;
  title: string;
  extract?: string;
  pageprops?: { wikibase_item?: string };
  thumbnail?: { source?: string };
}
async function wikiJson(url: string): Promise<unknown> {
  const res = await loggedFetch(url, {
    headers: { Accept: "application/json", "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  const data = await res.json() as { error?: { code?: string; info?: string } };
  if (data.error) {
    console.error(`[Arrival HTTP] Wikipedia status=200 API_ERROR ${data.error.code}`);
    throw new Error(`Wikipedia ${data.error.code}: ${data.error.info}`);
  }
  return data;
}

async function wikipediaSights(
  lang: "ro" | "en",
  lat: number,
  lon: number,
  radiusM: number,
): Promise<Place[]> {
  const host = `https://${lang}.wikipedia.org/w/api.php`;
  const geo = (await wikiJson(
    `${host}?action=query&list=geosearch&gscoord=${lat}%7C${lon}&gsradius=${radiusM}&gslimit=50&format=json&origin=*`,
  )) as { query?: { geosearch?: GeoRow[] } };
  const rows = geo.query?.geosearch ?? [];
  if (!rows.length) return [];
  const pages: Record<string, PageRow> = {};
  for (let i = 0; i < rows.length; i += 20) {
    const ids = rows
      .slice(i, i + 20)
      .map((r) => r.pageid)
      .join("%7C");
    try {
      const details = (await wikiJson(
        `${host}?action=query&prop=extracts%7Cpageimages%7Cpageprops&exintro=1&explaintext=1&exsentences=2&pithumbsize=200&pilimit=20&exlimit=20&pageids=${ids}&format=json&origin=*`,
      )) as { query?: { pages?: Record<string, PageRow> } };
      Object.assign(pages, details.query?.pages ?? {});
    } catch (error) {
      console.warn(`[Arrival source] Wikipedia descriptions unavailable language=${lang}`, error);
    }
  }
  return rows.map((row) => {
    const page = pages[String(row.pageid)];
    const description = page?.extract?.trim();
    return {
      id: `wiki:${lang}:${row.pageid}`,
      name: row.title,
      kind: categorizeSight(row.title, description),
      lat: row.lat,
      lon: row.lon,
      distance: Math.round(row.dist ?? distanceMeters([lat, lon], [row.lat, row.lon])),
      ...(description ? { description } : {}),
      ...(page?.thumbnail?.source ? { thumbnail: page.thumbnail.source } : {}),
      ...(page?.pageprops?.wikibase_item ? { wikidata: page.pageprops.wikibase_item } : {}),
      articleUrl: `https://${lang}.wikipedia.org/?curid=${row.pageid}`,
    } satisfies Place;
  });
}

interface SparqlRow {
  item: { value: string };
  c: { value: string };
  types: { value: string };
  en?: { value: string };
  ro?: { value: string };
}
const titleFromUrl = (url: string) =>
  decodeURIComponent(url.split("/wiki/")[1] ?? "").replace(/_/g, " ");

/**
 * Notable sights from Wikidata: typed items (parks, museums, churches…) inside the
 * radius, ranked by how many Wikipedias describe them, then Wikipedia intros.
 */
async function wikidataSights(
  lang: "ro" | "en",
  lat: number,
  lon: number,
  radiusM: number,
): Promise<Place[]> {
  const res = await loggedFetch("https://query.wikidata.org/sparql", {
    method: "POST",
    headers: {
      Accept: "application/sparql-results+json",
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": USER_AGENT,
    },
    body: new URLSearchParams({ query: sightsSparql(lat, lon, radiusM) }),
    signal: AbortSignal.timeout(14_000),
  });
  if (!res.ok) throw new Error(`Wikidata ${res.status}`);
  const rows = ((await res.json()) as { results?: { bindings?: SparqlRow[] } }).results?.bindings ?? [];
  const items = rows.flatMap((r) => {
    const m = r.c.value.match(/Point\(([-\d.eE]+) ([-\d.eE]+)\)/);
    if (!m) return [];
    const pLon = Number(m[1]),
      pLat = Number(m[2]);
    const useRo = lang === "ro" && r.ro;
    const url = useRo ? r.ro!.value : (r.en?.value ?? r.ro?.value);
    if (!url) return [];
    return [
      {
        qid: r.item.value.split("/").pop() ?? "",
        lang: (useRo || !r.en ? "ro" : "en") as "ro" | "en",
        title: titleFromUrl(url),
        lat: pLat,
        lon: pLon,
        kind: kindFromWikidataTypes(r.types.value.split(" ")),
      },
    ];
  });
  const details = new Map<string, PageRow>();
  for (const l of ["ro", "en"] as const) {
    const titles = items.filter((i) => i.lang === l).map((i) => i.title);
    for (let i = 0; i < titles.length; i += 20) {
      try {
        const data = (await wikiJson(
          `https://${l}.wikipedia.org/w/api.php?action=query&prop=extracts%7Cpageimages&exintro=1&explaintext=1&exsentences=2&exlimit=20&pithumbsize=200&pilimit=20&redirects=1&format=json&origin=*&titles=${encodeURIComponent(titles.slice(i, i + 20).join("|"))}`,
        )) as {
          query?: {
            pages?: Record<string, PageRow>;
            normalized?: { from: string; to: string }[];
            redirects?: { from: string; to: string }[];
          };
        };
        const alias = new Map<string, string>();
        for (const n of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])])
          alias.set(n.from, n.to);
        const byTitle = new Map(Object.values(data.query?.pages ?? {}).map((p) => [p.title, p]));
        for (const t of titles.slice(i, i + 20)) {
          let key = t;
          for (let hop = 0; hop < 3 && alias.has(key); hop++) key = alias.get(key)!;
          const page = byTitle.get(key);
          if (page) details.set(`${l}:${t}`, page);
        }
      } catch (error) {
        console.warn(`[Arrival source] Wikipedia intros unavailable language=${l}`, error);
      }
    }
  }
  return items.map((i) => {
    const page = details.get(`${i.lang}:${i.title}`);
    const description = page?.extract?.trim();
    return {
      id: `wd:${i.qid}`,
      name: i.title,
      kind: i.kind === "other" ? categorizeSight(i.title, description) : i.kind,
      lat: i.lat,
      lon: i.lon,
      distance: Math.round(distanceMeters([lat, lon], [i.lat, i.lon])),
      ...(description ? { description } : {}),
      ...(page?.thumbnail?.source ? { thumbnail: page.thumbnail.source } : {}),
      wikidata: i.qid,
      articleUrl: `https://${i.lang}.wikipedia.org/wiki/${encodeURIComponent(i.title.replace(/ /g, "_"))}`,
    } satisfies Place;
  });
}

/** Wikidata first (notable, typed); nearest Wikipedia articles fill small towns. */
async function sights(lang: "ro" | "en", lat: number, lon: number, radiusM: number): Promise<Place[]> {
  let notable: Place[] = [];
  try {
    notable = await wikidataSights(lang, lat, lon, radiusM);
  } catch (error) {
    console.warn("[Arrival source] Wikidata sights unavailable", error);
  }
  if (notable.length >= 15) return notable;
  let nearby: Place[];
  try {
    nearby = await wikipediaSights(lang, lat, lon, radiusM);
    if (lang === "ro" && nearby.length < 10)
      nearby = mergeSightLanguages(nearby, await wikipediaSights("en", lat, lon, radiusM));
  } catch (error) {
    if (lang === "ro") nearby = await wikipediaSights("en", lat, lon, radiusM).catch(() => []);
    else if (notable.length) nearby = [];
    else throw error;
  }
  if (!notable.length && !nearby.length) return [];
  const seen = new Set(notable.map((p) => p.wikidata).filter(Boolean));
  return [...notable, ...nearby.filter((p) => !p.wikidata || !seen.has(p.wikidata))];
}

async function overpassFallback(
  category: "food" | "sights" | "transport",
  lat: number,
  lon: number,
  radiusM: number,
): Promise<Place[]> {
  console.warn(`[Arrival source] Overpass fallback category=${category}`);
  return (
    await overpassSearch(
      category,
      lat,
      lon,
      radiusM,
      (url, init) => loggedFetch(String(url), init),
      8_000,
    )
  ).places;
}

export async function searchArrivalPlaces(
  category: "food" | "sights" | "transport",
  lat: number,
  lon: number,
  radiusM: number,
  lang: "ro" | "en",
): Promise<Place[]> {
  if (category === "transport") return overpassFallback(category, lat, lon, radiusM);
  try {
    if (category === "food") return await nominatimFood(lat, lon, radiusM);
    return await sights(lang, lat, lon, radiusM);
  } catch (error) {
    console.error(`[Arrival source] primary failed category=${category}`, error);
    return overpassFallback(category, lat, lon, radiusM);
  }
}
