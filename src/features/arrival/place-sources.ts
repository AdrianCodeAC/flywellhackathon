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
  if (/\b(muzeu\w*|museum\w*)\b/.test(text)) return "museum";
  if (
    /\b(biseric\w*|church\w*|cathedral\w*|catedral\w*|basilic\w*|chapel\w*|capel\w*|manastir\w*|monaster\w*)\b/.test(
      text,
    )
  )
    return "church";
  if (/\b(parc\w*|park\w*|garden\w*|gradin\w*)\b/.test(text)) return "park";
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

export function sourceCacheKey(
  category: "food" | "sights" | "transport",
  lat: number,
  lon: number,
  radiusM: number,
  lang: string,
): string {
  return `sources-v4:${category}:${lat.toFixed(3)},${lon.toFixed(3)}:${Math.round(radiusM)}${category === "sights" ? `:${lang === "ro" ? "ro" : "en"}` : ""}`;
}
