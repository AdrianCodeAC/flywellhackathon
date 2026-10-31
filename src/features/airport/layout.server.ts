/**
 * Server-only airport mapping. Terminals are located with one Nominatim tag search,
 * then one OpenStreetMap API `map` call covers just those buildings. The compact
 * result is cached for 30 days in the shared content cache so each airport is
 * fetched from OpenStreetMap at most once a month.
 */
import { cachedText, DAY } from "@/features/arrival/content-cache.server";
import { loggedFetch } from "@/features/arrival/external-http";
import { nominatimQueued } from "@/features/arrival/place-sources.server";
import { isPassengerTerminal, parseOsmMap, type AirportLayout, type OsmElement } from "./layout";

const USER_AGENT = "Flywell/1.0 (+https://flywellhackathon.lovable.app; airport passenger guide)";
type Box = [number, number, number, number]; // south, west, north, east

interface NominatimHit {
  name?: string;
  boundingbox?: [string, string, string, string];
}

async function terminalBoxes(lat: number, lon: number): Promise<{ name?: string; box: Box }[]> {
  const d = 0.04;
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({
      q: "[aeroway=terminal]",
      format: "jsonv2",
      limit: "20",
      bounded: "1",
      viewbox: `${lon - d},${lat + d},${lon + d},${lat - d}`,
    });
  try {
    const res = await nominatimQueued(url);
    if (!res.ok) return [];
    const hits = (await res.json()) as NominatimHit[];
    return hits.flatMap((h) => {
      const b = h.boundingbox?.map(Number);
      if (!b || b.some((v) => !Number.isFinite(v)) || !isPassengerTerminal(h.name)) return [];
      return [{ name: h.name, box: [b[0]!, b[2]!, b[1]!, b[3]!] as Box }];
    });
  } catch {
    return [];
  }
}

const area = (b: Box) => (b[2] - b[0]) * (b[3] - b[1]);
const union = (boxes: Box[]): Box => [
  Math.min(...boxes.map((b) => b[0])),
  Math.min(...boxes.map((b) => b[1])),
  Math.max(...boxes.map((b) => b[2])),
  Math.max(...boxes.map((b) => b[3])),
];
const grow = (b: Box, m: number): Box => [b[0] - m, b[1] - m * 1.4, b[2] + m, b[3] + m * 1.4];

/** Areas to try, largest first; big hubs fall back to the main terminal only. */
export function candidateBoxes(lat: number, lon: number, terminals: Box[]): Box[] {
  if (!terminals.length) return [grow([lat, lon, lat, lon], 0.006), grow([lat, lon, lat, lon], 0.003)];
  const main = [...terminals].sort((a, b) => area(b) - area(a))[0]!;
  const close = terminals.filter(
    (t) => Math.abs((t[0] + t[2]) / 2 - (main[0] + main[2]) / 2) < 0.012 && Math.abs((t[1] + t[3]) / 2 - (main[1] + main[3]) / 2) < 0.016,
  );
  return [grow(union(close), 0.0025), grow(union(close), 0.0008), grow(main, 0.0006)];
}

async function osmMap(box: Box): Promise<OsmElement[] | undefined> {
  const [s, w, n, e] = box;
  const url = `https://api.openstreetmap.org/api/0.6/map.json?bbox=${w.toFixed(5)},${s.toFixed(5)},${e.toFixed(5)},${n.toFixed(5)}`;
  try {
    const res = await loggedFetch(url, {
      headers: { Accept: "application/json", "User-Agent": USER_AGENT },
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { elements?: OsmElement[] };
    return body.elements;
  } catch {
    return undefined;
  }
}

export async function buildAirportLayout(
  iata: string,
  lat: number,
  lon: number,
): Promise<AirportLayout | undefined> {
  const terminals = await terminalBoxes(lat, lon);
  for (const box of candidateBoxes(lat, lon, terminals.map((t) => t.box))) {
    const elements = await osmMap(box);
    if (elements) return parseOsmMap(iata, elements, box);
  }
  return undefined;
}

export async function airportLayout(iata: string, baseUrl: string): Promise<AirportLayout | null> {
  const raw = await cachedText(`airport-layout-v1:${iata}`, 30 * DAY, async () => {
    const res = await fetch(new URL("/data/airports.json", baseUrl));
    const rows = (await res.json()) as [string, string, string, string, number, number][];
    const row = rows.find((r) => r[0] === iata);
    if (!row) return undefined;
    const layout = await buildAirportLayout(iata, row[4], row[5]);
    return layout ? JSON.stringify(layout) : undefined;
  });
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AirportLayout;
  } catch {
    return null;
  }
}
