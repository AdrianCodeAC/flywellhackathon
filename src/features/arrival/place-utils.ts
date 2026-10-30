import type { Place } from "./types";

export function distanceMeters(a: [number, number], b: [number, number]): number {
  const R = 6371000;
  const rad = Math.PI / 180;
  const dLat = (b[0] - a[0]) * rad;
  const dLon = (b[1] - a[1]) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[0] * rad) * Math.cos(b[0] * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function kindFromTags(t: Record<string, string>): Place["kind"] {
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

/** Places that have a Wikipedia article come first, then nearest. */
export function rankSights(places: Place[]): Place[] {
  return [...places].sort((a, b) => {
    const hasA = a.wikipedia || a.wikidata ? 0 : 1;
    const hasB = b.wikipedia || b.wikidata ? 0 : 1;
    if (hasA !== hasB) return hasA - hasB;
    return (a.distance ?? 0) - (b.distance ?? 0);
  });
}

/** Shared cache key: ~100 m grid + category + radius. */
export function overpassKey(category: string, lat: number, lon: number, radiusM: number): string {
  return `${category}:${lat.toFixed(3)},${lon.toFixed(3)}:${Math.round(radiusM)}`;
}
