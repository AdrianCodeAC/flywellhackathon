/**
 * Which airport steps a passenger must go through, in order, and where each one
 * is on the mapped airport. Steps come from the same rules as the checklist, so
 * a cabin-bag-only Schengen flight never shows bag drop or passport control.
 */
import { arrivalHours, isEu, isSchengen, type PreflightInput } from "@/features/preflight/rules";
import { gateMatches, type AirportLayout, type AirportPoi, type LatLon, type PoiKind } from "./layout";

export type StepId =
  | "arrive"
  | "checkin"
  | "security"
  | "passportOut"
  | "gate"
  | "passportIn"
  | "baggage"
  | "customs"
  | "exit";

export interface JourneyStep {
  id: StepId;
  /** Locale params for airportGuide.step.<id>.{title,detail}. */
  params?: Record<string, string | number> | undefined;
}

type Trip = Pick<PreflightInput, "origin" | "destination" | "bag">;

export function crossesSchengen(trip: Trip): boolean {
  return !(isSchengen(trip.origin.countryCode) && isSchengen(trip.destination.countryCode));
}

export function departureSteps(trip: Trip): JourneyStep[] {
  const steps: JourneyStep[] = [{ id: "arrive", params: { hours: arrivalHours(trip) } }];
  if (trip.bag === "checked") steps.push({ id: "checkin" });
  steps.push({ id: "security" });
  if (crossesSchengen(trip)) steps.push({ id: "passportOut" });
  steps.push({ id: "gate" });
  return steps;
}

export function arrivalSteps(trip: Trip): JourneyStep[] {
  const steps: JourneyStep[] = [];
  if (crossesSchengen(trip)) steps.push({ id: "passportIn" });
  if (trip.bag === "checked") steps.push({ id: "baggage" });
  if (isEu(trip.origin.countryCode) !== isEu(trip.destination.countryCode))
    steps.push({ id: "customs" });
  steps.push({ id: "exit", params: { city: trip.destination.city } });
  return steps;
}

export interface PlacedStep extends JourneyStep {
  at?: LatLon | undefined;
  /** True when OpenStreetMap has the exact spot; false = placed in the right building only. */
  exact: boolean;
  label?: string | undefined;
}

const STEP_KIND: Partial<Record<StepId, PoiKind>> = {
  checkin: "checkin",
  security: "security",
  passportOut: "passport",
  passportIn: "passport",
  baggage: "baggage",
  customs: "customs",
};

const dist = (a: LatLon, b: LatLon) => Math.hypot(a[0] - b[0], (a[1] - b[1]) * 0.7);

function nearest(pois: AirportPoi[], to: LatLon | undefined): AirportPoi | undefined {
  if (!to) return pois[0];
  return [...pois].sort((a, b) => dist(a.at, to) - dist(b.at, to))[0];
}

function size(rings: LatLon[][]) {
  const pts = rings.flat();
  const lats = pts.map((p) => p[0]);
  const lons = pts.map((p) => p[1]);
  return (Math.max(...lats) - Math.min(...lats)) * (Math.max(...lons) - Math.min(...lons));
}

/** The hall for this side: named and larger buildings win over unnamed annexes. */
export function mainTerminal(layout: AirportLayout, side: "departures" | "arrivals") {
  const rank = (list: AirportLayout["terminals"]) =>
    [...list].sort((a, b) => Number(Boolean(b.name)) - Number(Boolean(a.name)) || size(b.rings) - size(a.rings))[0];
  return (
    rank(layout.terminals.filter((t) => t.role === side)) ??
    rank(layout.terminals.filter((t) => t.role === "mixed")) ??
    rank(layout.terminals)
  );
}

/** Place steps on the map; `gate` is the number from the boarding pass, if typed. */
export function placeSteps(
  steps: JourneyStep[],
  layout: AirportLayout | undefined,
  side: "departures" | "arrivals",
  gate = "",
): PlacedStep[] {
  if (!layout) return steps.map((s) => ({ ...s, exact: false }));
  const hall = mainTerminal(layout, side)?.center;
  const of = (kind: PoiKind) => layout.pois.filter((p) => p.kind === kind);
  return steps.map((step) => {
    if (step.id === "arrive" || step.id === "exit") {
      if (step.id === "exit") {
        const ride = nearest(of("train"), hall) ?? nearest(of("bus"), hall) ?? nearest(of("taxi"), hall);
        if (ride) return { ...step, at: ride.at, exact: true, label: ride.label };
      }
      return { ...step, at: hall, exact: Boolean(hall) };
    }
    if (step.id === "gate") {
      const gates = of("gate");
      const mine = gate ? gates.find((g) => gateMatches(g.label, gate)) : undefined;
      if (mine) return { ...step, at: mine.at, exact: true, label: mine.label };
      if (gates.length) {
        const lat = gates.reduce((s, g) => s + g.at[0], 0) / gates.length;
        const lon = gates.reduce((s, g) => s + g.at[1], 0) / gates.length;
        return { ...step, at: [lat, lon] as LatLon, exact: false };
      }
      return { ...step, at: hall, exact: false };
    }
    const kind = STEP_KIND[step.id];
    const match = kind ? nearest(of(kind), hall) : undefined;
    if (match) return { ...step, at: match.at, exact: true, label: match.label };
    return { ...step, at: hall, exact: false };
  });
}
