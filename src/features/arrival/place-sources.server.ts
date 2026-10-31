import { loggedFetch } from "./external-http";
import {
  categorizeSight,
  FOOD_CATEGORIES,
  interleaveByKind,
  SIGHT_LIMITS,
  SIGHT_TYPES,
  widerFoodRadius,
  wikidataSearchUrl,
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

/**
 * Notable sights: one Wikidata search per kind (parks, museums, churches…) near the
 * centre, ranked by Wikidata's notability, then Wikipedia intros, photos and coordinates.
 */
async function wikidataSights(
  lang: "ro" | "en",
  lat: number,
  lon: number,
  radiusM: number,
): Promise<Place[]> {
  const kinds = SIGHT_TYPES.filter(([kind]) => SIGHT_LIMITS[kind]);
  const groups = await Promise.all(
    kinds.map(async ([kind, qids]) => {
      const data = (await wikiJson(
        wikidataSearchUrl(qids, lat, lon, radiusM, SIGHT_LIMITS[kind] ?? 8),
      )) as { query?: { search?: { title: string }[] } };
      return (data.query?.search ?? []).map((r) => ({ kind, qid: r.title }));
    }),
  );
  const seenQ = new Set<string>();
  const ranked = interleaveByKind(groups).filter((i) => !seenQ.has(i.qid) && seenQ.add(i.qid));
  if (!ranked.length) return [];

  // Article titles in Romanian / English.
  const titles = new Map<string, { ro?: string; en?: string }>();
  for (let i = 0; i < ranked.length; i += 50) {
    const ids = ranked.slice(i, i + 50).map((r) => r.qid).join("|");
    const data = (await wikiJson(
      `https://www.wikidata.org/w/api.php?action=wbgetentities&props=sitelinks&sitefilter=enwiki%7Crowiki&format=json&origin=*&ids=${encodeURIComponent(ids)}`,
    )) as { entities?: Record<string, { sitelinks?: Record<string, { title: string }> }> };
    for (const [q, e] of Object.entries(data.entities ?? {}))
      titles.set(q, { ro: e.sitelinks?.["rowiki"]?.title, en: e.sitelinks?.["enwiki"]?.title });
  }
  const items = ranked.flatMap((r) => {
    const t = titles.get(r.qid);
    const l: "ro" | "en" | undefined =
      lang === "ro" && t?.ro ? "ro" : t?.en ? "en" : t?.ro ? "ro" : undefined;
    const title = l ? t?.[l] : undefined;
    return l && title ? [{ ...r, lang: l, title }] : [];
  });

  const details = new Map<string, PageRow & { coordinates?: { lat: number; lon: number }[] }>();
  await Promise.all(
    (["ro", "en"] as const).flatMap((l) => {
      const list = items.filter((i) => i.lang === l).map((i) => i.title);
      const batches: string[][] = [];
      for (let i = 0; i < list.length; i += 20) batches.push(list.slice(i, i + 20));
      return batches.map(async (batch) => {
        try {
          const data = (await wikiJson(
            `https://${l}.wikipedia.org/w/api.php?action=query&prop=extracts%7Cpageimages%7Ccoordinates&exintro=1&explaintext=1&exsentences=2&exlimit=20&pithumbsize=200&pilimit=20&colimit=20&redirects=1&format=json&origin=*&titles=${encodeURIComponent(batch.join("|"))}`,
          )) as {
            query?: {
              pages?: Record<string, PageRow & { coordinates?: { lat: number; lon: number }[] }>;
              normalized?: { from: string; to: string }[];
              redirects?: { from: string; to: string }[];
            };
          };
          const alias = new Map<string, string>();
          for (const n of [...(data.query?.normalized ?? []), ...(data.query?.redirects ?? [])])
            alias.set(n.from, n.to);
          const byTitle = new Map(Object.values(data.query?.pages ?? {}).map((p) => [p.title, p]));
          for (const t of batch) {
            let key = t;
            for (let hop = 0; hop < 3 && alias.has(key); hop++) key = alias.get(key)!;
            const page = byTitle.get(key);
            if (page) details.set(`${l}:${t}`, page);
          }
        } catch (error) {
          console.warn(`[Arrival source] Wikipedia intros unavailable language=${l}`, error);
        }
      });
    }),
  );

  return items.flatMap((i) => {
    const page = details.get(`${i.lang}:${i.title}`);
    const coord = page?.coordinates?.[0];
    if (!coord) return [];
    const description = page?.extract?.trim();
    return [
      {
        id: `wd:${i.qid}`,
        name: i.title,
        kind: i.kind,
        lat: coord.lat,
        lon: coord.lon,
        distance: Math.round(distanceMeters([lat, lon], [coord.lat, coord.lon])),
        ...(description ? { description } : {}),
        ...(page?.thumbnail?.source ? { thumbnail: page.thumbnail.source } : {}),
        wikidata: i.qid,
        articleUrl: `https://${i.lang}.wikipedia.org/wiki/${encodeURIComponent(i.title.replace(/ /g, "_"))}`,
      } satisfies Place,
    ];
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
