/**
 * Pure airport-layout helpers: turn OpenStreetMap elements into a compact,
 * device-cacheable description of one airport (terminal outlines, aprons,
 * runways, gates and passenger services). No network access here.
 */

export type PoiKind =
  | "checkin"
  | "security"
  | "passport"
  | "baggage"
  | "customs"
  | "gate"
  | "toilets"
  | "food"
  | "pharmacy"
  | "medical"
  | "atm"
  | "exchange"
  | "info"
  | "lounge"
  | "bus"
  | "train"
  | "taxi"
  | "carRental"
  | "parking";

/** [lat, lon] rounded to 5 decimals (~1 m). */
export type LatLon = [number, number];

export interface AirportPoi {
  kind: PoiKind;
  at: LatLon;
  label?: string | undefined;
  level?: string | undefined;
}

export type TerminalRole = "departures" | "arrivals" | "mixed";

export interface AirportTerminal {
  name?: string | undefined;
  role: TerminalRole;
  rings: LatLon[][];
  center: LatLon;
}

export interface AirportLayout {
  version: 1;
  iata: string;
  /** [south, west, north, east] of the mapped area. */
  bounds: [number, number, number, number];
  terminals: AirportTerminal[];
  aprons: LatLon[][];
  runways: LatLon[][];
  taxiways: LatLon[][];
  pois: AirportPoi[];
  fetchedAt: string;
}

export const LAYOUT_VERSION = 1 as const;

interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}
interface OsmWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}
interface OsmRelation {
  type: "relation";
  id: number;
  members: { type: string; ref: number; role: string }[];
  tags?: Record<string, string>;
}
export type OsmElement = OsmNode | OsmWay | OsmRelation;

const round = (n: number) => Math.round(n * 1e5) / 1e5;
const pt = (lat: number, lon: number): LatLon => [round(lat), round(lon)];

/** Names in the languages of the airports we serve most, matched case-insensitively. */
const NAME_RULES: [PoiKind, RegExp][] = [
  ["baggage", /baggage (claim|reclaim|hall)|luggage reclaim|baggage carousel|preluare bagaj|ritiro bagagli|recogida de equipajes|gepäckausgabe|livraison des bagages|retrait des bagages/i],
  ["checkin", /check.?in|bag drop|înregistrare|inregistrare|accettazione|facturaci|enregistrement/i],
  ["security", /security|securitate|sicurezza|seguridad|sûreté|sicherheitskontrolle|control de securitate/i],
  ["passport", /passport|pașaport|paşaport|pasaport|immigration|border control|frontier|controllo passaporti|control de pasaportes|passkontrolle/i],
  ["customs", /customs|vamă|vama|dogana|aduana|douane|zoll/i],
];

export function kindFromName(name: string | undefined): PoiKind | undefined {
  if (!name) return undefined;
  return NAME_RULES.find(([, re]) => re.test(name))?.[0];
}

/** Classify one tagged OSM object; undefined when it is not useful to passengers. */
export function poiKind(tags: Record<string, string>): PoiKind | undefined {
  const { aeroway, amenity, railway, highway, shop, tourism, barrier, office, healthcare } = tags;
  if (aeroway === "gate") return "gate";
  if (aeroway === "check-in" || aeroway === "check_in" || amenity === "check_in") return "checkin";
  if (
    amenity === "security_control" ||
    aeroway === "security_checkpoint" ||
    aeroway === "departure_security_check" ||
    aeroway === "security_control" ||
    aeroway === "security"
  )
    return "security";
  if (barrier === "border_control" || aeroway === "passport_control") return "passport";
  if (
    aeroway === "baggage_claim" ||
    aeroway === "baggage_carousel" ||
    aeroway === "baggage carousel" ||
    aeroway === "luggage_belt" ||
    amenity === "baggage_claim"
  )
    return "baggage";
  if (amenity === "customs" || office === "customs" || aeroway === "customs") return "customs";
  if (amenity === "toilets") return "toilets";
  if (["cafe", "restaurant", "fast_food", "bar", "pub", "food_court"].includes(amenity ?? ""))
    return "food";
  if (amenity === "pharmacy" || shop === "chemist") return "pharmacy";
  if (["doctors", "clinic", "first_aid"].includes(amenity ?? "") || healthcare === "first_aid")
    return "medical";
  if (amenity === "atm" || amenity === "bank") return "atm";
  if (amenity === "bureau_de_change") return "exchange";
  if (tourism === "information" && tags["information"] === "office") return "info";
  if (amenity === "lounge" || aeroway === "airport_lounge" || aeroway === "lounge") return "lounge";
  if (railway === "station" || railway === "halt") return "train";
  if (highway === "bus_stop" || amenity === "bus_station") return "bus";
  if (amenity === "taxi") return "taxi";
  if (amenity === "car_rental") return "carRental";
  if (amenity === "parking" && tags["name"]) return "parking";
  return undefined;
}

const DEPARTURES = /depart|plec|abflug|partenz|salida|départ|odlot|odlet|airside/i;
const ARRIVALS = /arriv|sosir|ankunft|arrivi|llegad|przylot|přílet/i;
const NOT_PASSENGER = /cargo|general aviation|\bGA\b|business aviation|vip|salon oficial|harrods|fbo|freight|hangar/i;

export function terminalRole(name: string | undefined): TerminalRole {
  if (!name) return "mixed";
  if (DEPARTURES.test(name) && !ARRIVALS.test(name)) return "departures";
  if (ARRIVALS.test(name) && !DEPARTURES.test(name)) return "arrivals";
  return "mixed";
}

/** Bounding boxes [s, w, n, e] of passenger terminal ways in a raw OSM response. */
export function terminalWayBoxes(elements: OsmElement[]): [number, number, number, number][] {
  const nodes = new Map<number, OsmNode>();
  for (const e of elements) if (e.type === "node") nodes.set(e.id, e);
  return elements.flatMap((e) => {
    const t = e.tags;
    if (e.type !== "way" || !t) return [];
    if (!(t["aeroway"] === "terminal" || t["building"] === "terminal")) return [];
    if (!isPassengerTerminal(t["name"])) return [];
    const pts = e.nodes.flatMap((id) => (nodes.has(id) ? [nodes.get(id)!] : []));
    if (!pts.length) return [];
    return [[
      Math.min(...pts.map((p) => p.lat)),
      Math.min(...pts.map((p) => p.lon)),
      Math.max(...pts.map((p) => p.lat)),
      Math.max(...pts.map((p) => p.lon)),
    ] as [number, number, number, number]];
  });
}

export const isPassengerTerminal = (name: string | undefined) => !name || !NOT_PASSENGER.test(name);

/** Douglas–Peucker in degree space; tolerance ~3 m keeps outlines recognisable. */
export function simplify(points: LatLon[], tolerance = 0.00003): LatLon[] {
  if (points.length <= 3) return points;
  const sq = tolerance * tolerance;
  const keep = new Uint8Array(points.length);
  keep[0] = keep[points.length - 1] = 1;
  const stack: [number, number][] = [[0, points.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ay, ax] = points[a]!;
    const [by, bx] = points[b]!;
    let max = 0;
    let index = -1;
    for (let i = a + 1; i < b; i++) {
      const [py, px] = points[i]!;
      const dx = bx - ax;
      const dy = by - ay;
      const len = dx * dx + dy * dy;
      const t = len ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len)) : 0;
      const ex = ax + t * dx - px;
      const ey = ay + t * dy - py;
      const d = ex * ex + ey * ey;
      if (d > max) {
        max = d;
        index = i;
      }
    }
    if (index > 0 && max > sq) {
      keep[index] = 1;
      stack.push([a, index], [index, b]);
    }
  }
  return points.filter((_, i) => keep[i]);
}

export function centroid(points: LatLon[]): LatLon {
  let lat = 0;
  let lon = 0;
  for (const [y, x] of points) {
    lat += y;
    lon += x;
  }
  return pt(lat / Math.max(points.length, 1), lon / Math.max(points.length, 1));
}

/** Join unordered outer-member ways of a multipolygon into closed rings. */
export function joinRings(ways: LatLon[][]): LatLon[][] {
  const pending = ways.filter((w) => w.length > 1).map((w) => [...w]);
  const rings: LatLon[][] = [];
  const same = (a: LatLon, b: LatLon) => a[0] === b[0] && a[1] === b[1];
  while (pending.length) {
    const ring = pending.shift()!;
    let grew = true;
    while (!same(ring[0]!, ring[ring.length - 1]!) && grew) {
      grew = false;
      for (let i = 0; i < pending.length; i++) {
        const w = pending[i]!;
        const end = ring[ring.length - 1]!;
        if (same(end, w[0]!)) ring.push(...w.slice(1));
        else if (same(end, w[w.length - 1]!)) ring.push(...[...w].reverse().slice(1));
        else continue;
        pending.splice(i, 1);
        grew = true;
        break;
      }
    }
    rings.push(ring);
  }
  return rings;
}

const LIMITS: Partial<Record<PoiKind, number>> = {
  gate: 160,
  food: 30,
  bus: 12,
  parking: 8,
  carRental: 6,
  toilets: 30,
  atm: 12,
};

/** Build a compact layout from an OSM API `map` response. */
export function parseOsmMap(
  iata: string,
  elements: OsmElement[],
  bounds: [number, number, number, number],
  fetchedAt = new Date().toISOString(),
): AirportLayout {
  const nodes = new Map<number, OsmNode>();
  const ways = new Map<number, OsmWay>();
  for (const e of elements) {
    if (e.type === "node") nodes.set(e.id, e);
    else if (e.type === "way") ways.set(e.id, e);
  }
  const wayPoints = (w: OsmWay): LatLon[] =>
    w.nodes.flatMap((id) => {
      const n = nodes.get(id);
      return n ? [pt(n.lat, n.lon)] : [];
    });
  const [s, w, n, e] = bounds;
  const inside = ([lat, lon]: LatLon) => lat >= s && lat <= n && lon >= w && lon <= e;

  const terminals: AirportTerminal[] = [];
  const aprons: LatLon[][] = [];
  const runways: LatLon[][] = [];
  const taxiways: LatLon[][] = [];
  const pois: AirportPoi[] = [];
  const addTerminal = (name: string | undefined, rings: LatLon[][]) => {
    const clean = rings.map((r) => simplify(r)).filter((r) => r.length > 2);
    if (!clean.length || !isPassengerTerminal(name)) return;
    terminals.push({ name, role: terminalRole(name), rings: clean, center: centroid(clean.flat()) });
  };

  for (const el of elements) {
    const tags = el.tags;
    if (!tags) continue;
    const name = tags["name:en"] ?? tags["name"] ?? undefined;
    if (el.type === "way") {
      const points = wayPoints(el);
      if (!points.length) continue;
      if (tags["aeroway"] === "terminal" || (tags["building"] === "terminal" && !tags["aeroway"])) {
        addTerminal(name, [points]);
        continue;
      }
      if (tags["aeroway"] === "apron") {
        aprons.push(simplify(points, 0.00006));
        continue;
      }
      if (tags["aeroway"] === "runway") {
        runways.push(simplify(points, 0.00006));
        continue;
      }
      if (tags["aeroway"] === "taxiway") {
        taxiways.push(simplify(points, 0.00006));
        continue;
      }
    } else if (el.type === "relation") {
      if (tags["aeroway"] === "terminal" && tags["type"] === "multipolygon") {
        const outer = el.members
          .filter((m) => m.type === "way" && m.role !== "inner")
          .flatMap((m) => {
            const way = ways.get(m.ref);
            return way ? [wayPoints(way)] : [];
          });
        addTerminal(name, joinRings(outer));
      }
      continue;
    }

    let kind = poiKind(tags);
    if (!kind && tags["indoor"] && tags["indoor"] !== "wall") kind = kindFromName(tags["name"]);
    if (!kind) continue;
    const at =
      el.type === "node" ? pt(el.lat, el.lon) : el.type === "way" ? centroid(wayPoints(el)) : undefined;
    if (!at || !inside(at)) continue;
    const label = kind === "gate" ? (tags["ref"] ?? tags["name"]) : name;
    pois.push({ kind, at, label: label?.slice(0, 60), level: tags["level"]?.slice(0, 8) });
  }

  // Building parts and their outline relation often duplicate each other: when a
  // terminal is split into named parts, keep the parts and drop the whole outline.
  const parts = terminals.filter((t) => t.role !== "mixed");
  const kept = parts.length
    ? [...parts, ...terminals.filter((t) => t.role === "mixed" && !parts.some((p) => near(p.center, t.center, 0.004)))]
    : terminals;

  const counts = new Map<PoiKind, number>();
  const seen = new Set<string>();
  const limited = pois.filter((p) => {
    const key = `${p.kind}:${p.label ?? ""}:${p.at[0].toFixed(4)},${p.at[1].toFixed(4)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    const c = (counts.get(p.kind) ?? 0) + 1;
    counts.set(p.kind, c);
    return c <= (LIMITS[p.kind] ?? 20);
  });

  return {
    version: LAYOUT_VERSION,
    iata,
    bounds,
    terminals: kept,
    aprons: aprons.slice(0, 40),
    runways: runways.slice(0, 6),
    taxiways: taxiways.slice(0, 60),
    pois: limited,
    fetchedAt,
  };
}

const near = (a: LatLon, b: LatLon, d: number) => Math.abs(a[0] - b[0]) < d && Math.abs(a[1] - b[1]) < d;

/** Gate refs such as "28/29" or "A12-A14" match a typed "29" / "a13". */
export function gateMatches(ref: string | undefined, typed: string): boolean {
  if (!ref) return false;
  const want = typed.trim().toUpperCase().replace(/\s+/g, "");
  if (!want) return false;
  const parts = ref.toUpperCase().replace(/\s+/g, "").split(/[/;,]/);
  return parts.some((part) => {
    if (part === want) return true;
    const range = /^([A-Z]*)(\d+)-([A-Z]*)(\d+)$/.exec(part);
    const one = /^([A-Z]*)(\d+)$/.exec(want);
    if (!range || !one) return false;
    const prefix = range[1] || range[3] || "";
    return prefix === one[1] && +one[2]! >= +range[2]! && +one[2]! <= +range[4]!;
  });
}
