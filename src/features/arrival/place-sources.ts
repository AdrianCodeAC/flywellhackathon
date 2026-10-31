import type { Place } from "./types";
import { distanceMeters } from "./place-utils";

export const FOOD_CATEGORIES = ["restaurant", "fast food", "cafe"] as const;
export const DEFAULT_FOOD_AREA = "center" as const;

/** Nominatim wants left/top/right/bottom (west,north,east,south). */
export function areaViewbox(lat: number, lon: number, radiusM: number): string {
  const dy = radiusM / 111_320;
  const dx = radiusM / (111_320 * Math.max(0.01, Math.cos((lat * Math.PI) / 180)));
  return [
    Math.max(-180, lon - dx),
    Math.min(90, lat + dy),
    Math.min(180, lon + dx),
    Math.max(-90, lat - dy),
  ]
    .map((n) => n.toFixed(6))
    .join(",");
}

export function foodSearchUrl(
  category: (typeof FOOD_CATEGORIES)[number],
  lat: number,
  lon: number,
  radiusM: number,
): string {
  const params = new URLSearchParams({
    q: category,
    format: "jsonv2",
    limit: "40",
    bounded: "1",
    viewbox: areaViewbox(lat, lon, radiusM),
    extratags: "1",
    addressdetails: "1",
  });
  return `https://nominatim.openstreetmap.org/search?${params}`;
}

export interface FoodHit {
  place_id?: number;
  osm_type?: string;
  osm_id?: number;
  name?: string;
  display_name?: string;
  type?: string;
  lat: string;
  lon: string;
  extratags?: Record<string, string> | null;
}

export function parseFoodHits(
  rows: FoodHit[],
  category: (typeof FOOD_CATEGORIES)[number],
  lat: number,
  lon: number,
): Place[] {
  const fallback = category === "fast food" ? "fast_food" : category;
  return rows.flatMap((row) => {
    const pLat = Number(row.lat),
      pLon = Number(row.lon);
    const name = row.name?.trim() || row.display_name?.split(",")[0]?.trim();
    if (!name || !Number.isFinite(pLat) || !Number.isFinite(pLon)) return [];
    const extra = row.extratags ?? {};
    const kind =
      row.type === "restaurant" || row.type === "fast_food" || row.type === "cafe"
        ? row.type
        : fallback;
    const phone = extra["phone"] || extra["contact:phone"];
    return [
      {
        id: row.osm_id
          ? `${row.osm_type}/${row.osm_id}`
          : `nominatim/${row.place_id ?? `${pLat},${pLon}`}`,
        name,
        kind,
        lat: pLat,
        lon: pLon,
        distance: Math.round(distanceMeters([lat, lon], [pLat, pLon])),
        ...(extra["opening_hours"] ? { openingHours: extra["opening_hours"] } : {}),
        ...(extra["cuisine"]
          ? { cuisine: extra["cuisine"].replace(/_/g, " ").replace(/;/g, ", ") }
          : {}),
        ...(phone ? { phone: phone.split(";")[0]?.trim() ?? phone } : {}),
      },
    ];
  });
}

export function categorizeSight(title: string, description = ""): Place["kind"] {
  const text = `${title} ${description}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  if (/\b(muzeu\w*|museum\w*|muse[oeu]\w*|musee\w*)\b/.test(text)) return "museum";
  if (
    /\b(biseric\w*|church\w*|cathedral\w*|catedral\w*|basilic\w*|chapel\w*|capel\w*|manastir\w*|monaster\w*|iglesia\w*|eglise\w*|chiesa\w*|duomo|igreja\w*|kirche\w*|abbey\w*|mosque\w*|moschee\w*|synagog\w*)\b/.test(
      text,
    )
  )
    return "church";
  if (/\b(parc\w*|park\w*|parque\w*|garden\w*|gradin\w*|jardin\w*|jardim\w*|giardin\w*|botanic\w*)\b/.test(text)) return "park";
  if (/\b(monument\w*|memorial\w*|statu\w*)\b/.test(text)) return "monument";
  return "other";
}

/** Prefer the Romanian page when both languages describe the same coordinates. */
export function mergeSightLanguages(primary: Place[], english: Place[]): Place[] {
  const result = [...primary];
  for (const p of english) {
    if (
      !result.some(
        (existing) =>
          (existing.wikidata && existing.wikidata === p.wikidata) || existing.id === p.id,
      )
    )
      result.push(p);
  }
  return result.sort((a, b) => (a.distance ?? 0) - (b.distance ?? 0));
}

/** Second, wider food search when the first box found fewer than 15 places (max 4 km). */
export function widerFoodRadius(radiusM: number, found: number): number | null {
  if (found >= 15 || radiusM >= 4000) return null;
  return Math.min(Math.round(radiusM * 2.5), 4000);
}

/** Wikidata classes that make a place worth visiting, mapped to our kinds (first match wins). */
export const SIGHT_TYPES: [Place["kind"], string[]][] = [
  ["park", ["Q22698", "Q22746", "Q167346", "Q1107656", "Q3215290"]],
  ["church", ["Q16970", "Q2977", "Q163687", "Q44613", "Q32815", "Q34627", "Q120560", "Q108325"]],
  ["museum", ["Q33506", "Q207694", "Q17431399", "Q588140", "Q1007870"]],
  ["castle", ["Q23413", "Q16560", "Q57821", "Q1785071"]],
  ["monument", ["Q4989906", "Q575759", "Q179700", "Q483453", "Q1885014"]],
  ["viewpoint", ["Q6017969", "Q1440300"]],
  ["attraction", ["Q174782", "Q570116", "Q24354", "Q153562", "Q12280", "Q12518", "Q43501", "Q2281788", "Q839954", "Q1081138"]],
];

export function kindFromWikidataTypes(qids: string[]): Place["kind"] {
  for (const [kind, ids] of SIGHT_TYPES) if (qids.some((q) => ids.includes(q))) return kind;
  return "other";
}

/** How many notable items to ask for per kind; the order is also the interleave priority. */
export const SIGHT_LIMITS: Partial<Record<Place["kind"], number>> = {
  museum: 14,
  park: 12,
  castle: 8,
  church: 10,
  attraction: 12,
  monument: 8,
  viewpoint: 4,
};

/** Wikidata full-text search: items of these classes near a point, most notable first. */
export function wikidataSearchUrl(qids: string[], lat: number, lon: number, radiusM: number, limit: number): string {
  const query = `haswbstatement:${qids.map((q) => `P31=${q}`).join("|")} nearcoord:${Math.round(radiusM / 1000)}km,${lat.toFixed(4)},${lon.toFixed(4)}`;
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: String(limit),
    srprop: "",
    format: "json",
    origin: "*",
  });
  return `https://www.wikidata.org/w/api.php?${params}`;
}

/** Round-robin by kind so one category never crowds out the others. */
export function interleaveByKind<T extends { kind: Place["kind"] }>(groups: T[][]): T[] {
  const out: T[] = [];
  for (let i = 0; groups.some((g) => i < g.length); i++)
    for (const g of groups) if (g[i]) out.push(g[i]!);
  return out;
}

export function sourceCacheKey(
  category: "food" | "sights" | "transport",
  lat: number,
  lon: number,
  radiusM: number,
  lang: string,
): string {
  return `sources-v5:${category}:${lat.toFixed(3)},${lon.toFixed(3)}:${Math.round(radiusM)}${category === "sights" ? `:${lang === "ro" ? "ro" : "en"}` : ""}`;
}
