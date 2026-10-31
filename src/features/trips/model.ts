import { z } from "zod";
import { preflightInputSchema, type PreflightInput } from "@/features/preflight/rules";

/** One flight the passenger is taking: the pre-flight answers plus what the planner knew. */
export const myTripSchema = z.object({
  id: z.string().regex(/^[A-Z]{3}-[A-Z]{3}-\d{4}-\d{2}-\d{2}$/),
  input: preflightInputSchema,
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  airline: z.string().max(60).default(""),
  addedAt: z.string(),
  /** True once the trip is stored in the signed-in account. */
  synced: z.boolean().default(false),
});
export type MyTrip = z.infer<typeof myTripSchema>;

export const TRIP_TABS = ["before", "during", "arrival"] as const;
export type TripTab = (typeof TRIP_TABS)[number];

/** Same route on the same day is the same trip, so adding it twice replaces it. */
export const tripIdFor = (input: Pick<PreflightInput, "origin" | "destination" | "date">) =>
  `${input.origin.iata}-${input.destination.iata}-${input.date}`;

const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Before the flight day you prepare; after it you have landed. The flight day opens on "before". */
export function defaultTab(trip: Pick<MyTrip, "input">, today = new Date()): TripTab {
  return trip.input.date < iso(today) ? "arrival" : "before";
}

export const isPast = (trip: Pick<MyTrip, "input" | "returnDate">, today = new Date()) =>
  (trip.returnDate ?? trip.input.date) < iso(today);

/** Upcoming trips first (soonest at the top), past trips after them (latest first). */
export function sortTrips<T extends Pick<MyTrip, "input" | "returnDate">>(trips: T[], today = new Date()): T[] {
  return [...trips].sort((a, b) => {
    const pa = isPast(a, today), pb = isPast(b, today);
    if (pa !== pb) return pa ? 1 : -1;
    return pa ? b.input.date.localeCompare(a.input.date) : a.input.date.localeCompare(b.input.date);
  });
}

export function makeTrip(input: PreflightInput, extra: { returnDate?: string | null; airline?: string } = {}, now = new Date()): MyTrip {
  return {
    id: tripIdFor(input),
    input,
    returnDate: extra.returnDate ?? null,
    airline: (extra.airline ?? input.airline).slice(0, 60),
    addedAt: now.toISOString(),
    synced: false,
  };
}

/**
 * Turns a flight chosen in the planner into pre-flight answers. Citizenship comes from the
 * passenger's previous trip when there is one; otherwise Romanian for RO and EU for EN.
 */
export function inputFromPlan(plan: {
  origin: { iata: string; city: string; countryCode: string };
  destination: { iata: string; city: string; countryCode: string };
  departure: string;
  airline: string;
  children: number;
  bag: boolean;
  lang: "en" | "ro";
  previous?: Pick<PreflightInput, "citizenship"> | null;
}): PreflightInput {
  return {
    origin: plan.origin,
    destination: plan.destination,
    date: plan.departure.slice(0, 10),
    citizenship: plan.previous?.citizenship ?? (plan.lang === "ro" ? "ro" : "eu"),
    bag: plan.bag ? "checked" : "cabin",
    airline: plan.airline.slice(0, 60),
    children: plan.children > 0,
    medication: false,
    pet: false,
    lang: plan.lang,
  };
}
