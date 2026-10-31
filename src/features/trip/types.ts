import { z } from "zod";

export const SIX_HOURS = 6 * 60 * 60 * 1000;
export const tripInputSchema = z.object({
  destination: z.string().trim().min(2).max(200),
  destinationIata: z.string().regex(/^[A-Z]{3}$/).nullable(),
  origin: z.string().regex(/^[A-Z]{3}$/).default("CRA"),
  departure: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  returnDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  adults: z.number().int().min(1).max(9),
  children: z.number().int().min(0).max(8),
  flexible: z.boolean(),
  budget: z.enum(["budget", "medium", "comfort"]),
  direct: z.boolean(),
  bag: z.boolean(),
  lang: z.enum(["en", "ro"]),
}).refine((v) => Number.isFinite(Date.parse(v.departure)) && Number.isFinite(Date.parse(v.returnDate)) && nights(v.departure, v.returnDate) > 0 && nights(v.departure, v.returnDate) <= 90 && v.departure >= new Date().toISOString().slice(0,10), { message: "Invalid travel dates", path: ["returnDate"] })
  .refine((v) => v.adults + v.children <= 9, { message: "Maximum 9 travellers", path: ["children"] });
export type TripInput = z.infer<typeof tripInputSchema>;
export type Destination = { iata: string; city: string; country: string; lat: number; lon: number };
export type Flight = {
  id: string; airline: string; departure: string; returnDate: string; price: number;
  stops: number; duration: number | null; layover: number | null; arrival: string | null;
  score: number; link: string; currency: string;
};
export type FlightResult = { flights: Flight[]; error: string | null; fetchedAt: string; baggageUnknown: boolean };
export const adviceSchema = z.object({
  areas: z.array(z.object({ name: z.string(), reason: z.string(), nightlyMinEur: z.number(), nightlyMaxEur: z.number() }).strict()).length(3),
  foodPerPersonEur: z.array(z.number()).length(2),
  transportPerPersonEur: z.array(z.number()).length(2),
  activitiesPerPersonEur: z.array(z.number()).length(2),
  documents: z.string(),
  wellbeing: z.array(z.string()).length(3),
  currency: z.string(),
}).strict();
export type TripAdvice = z.infer<typeof adviceSchema>;
export type Extras = { weather: { min: number; max: number; climate: boolean; sourceYear: number | null } | null; rate: number | null; localRate: number | null; localCurrency: string | null; rateDate: string | null };
export type TripResult = { input: TripInput; destination: Destination; flights?: FlightResult; advice?: TripAdvice; extras?: Extras; adviceError?: string; cached?: boolean };
export type TripEvent = { type: "destination"; destination: Destination } | { type: "suggestions"; destinations: Destination[] } | { type: "flights"; value: FlightResult } | { type: "advice"; value: TripAdvice } | { type: "extras"; value: Extras } | { type: "error"; section: string; message: string } | { type: "done"; cached?: boolean };
export function nights(from: string, to: string) { return Math.round((Date.parse(to) - Date.parse(from)) / 86400000); }
export function tripCacheKey(input: TripInput) { return `trip-v2:${JSON.stringify(input)}`; }
export function rememberedTab(value: string | null) { return value === "arrival" ? "arrival" : "plan"; }

export function comfortScore(f: Pick<Flight, "stops" | "duration" | "layover" | "departure" | "arrival">) {
  const night = (s: string | null) => s ? Number(s.slice(11,13)) >= 23 || Number(s.slice(11,13)) < 6 : false;
  return Math.max(0, Math.round(100 - f.stops * 18 - (f.duration ? Math.max(0, f.duration - 180) / 30 : 0) - (f.layover ? Math.max(0, f.layover - 120) / 30 : 0) - (night(f.departure) ? 15 : 0) - (night(f.arrival) ? 15 : 0)));
}
export function rankFlights(flights: Flight[]) {
  if (!flights.length) return [];
  const cheapest = [...flights].sort((a,b) => a.price-b.price)[0];
  const comfortable = [...flights].sort((a,b) => b.score-a.score || a.price-b.price)[0];
  const min = Math.min(...flights.map(f=>f.price));
  const best = [...flights].sort((a,b)=>(b.score - (b.price/min-1)*25)-(a.score-(a.price/min-1)*25))[0];
  return [{ role: "best", flight: best }, { role: "cheapest", flight: cheapest }, { role: "comfortable", flight: comfortable }].filter((r): r is { role: string; flight: Flight } => Boolean(r.flight));
}
export function dateMatches(actual: string, requested: string, flexible: boolean) { return Math.abs(nights(actual.slice(0,10),requested)) <= (flexible ? 3 : 0); }
export function bookingLinks(input: TripInput, city: string) {
  const guests = input.adults + input.children;
  return {
    booking: `https://www.booking.com/searchresults.html?${new URLSearchParams({ ss: city, checkin: input.departure, checkout: input.returnDate, group_adults: String(input.adults), group_children: String(input.children), no_rooms: "1" })}`,
    airbnb: `https://www.airbnb.com/s/${encodeURIComponent(city)}/homes?${new URLSearchParams({ checkin: input.departure, checkout: input.returnDate, adults: String(input.adults), children: String(input.children) })}`,
    google: `https://www.google.com/travel/flights?q=${encodeURIComponent(`${input.origin} to ${input.destinationIata ?? city} ${input.departure} return ${input.returnDate} ${guests} passengers${input.direct ? " nonstop" : ""}`)}`,
    skyscanner: `https://www.skyscanner.net/transport/flights/${input.origin.toLowerCase()}/${(input.destinationIata ?? city).toLowerCase()}/${input.departure.slice(2).replaceAll("-","")}/${input.returnDate.slice(2).replaceAll("-","")}/?${new URLSearchParams({ adults: String(input.adults), children: String(input.children), adultsv2: String(input.adults), cabinclass: "economy", preferdirects: String(input.direct) })}`,
  };
}
export function stayCosts(input: TripInput, advice: TripAdvice, flight: Flight | undefined, rate: number) {
  const days = nights(input.departure,input.returnDate), people = input.adults + input.children;
  const areas = advice.areas;
  const accommodation = [Math.min(...areas.map(a=>a.nightlyMinEur)),Math.max(...areas.map(a=>a.nightlyMaxEur))].map(v=>v*days*rate);
  const scaled = (v: number[]) => v.map(x=>x*days*people*rate);
  const rows = [ { key:"flights",range:flight ? [flight.price*people,flight.price*people] : null }, {key:"accommodation",range:accommodation}, {key:"food",range:scaled(advice.foodPerPersonEur)}, {key:"transport",range:scaled(advice.transportPerPersonEur)}, {key:"activities",range:scaled(advice.activitiesPerPersonEur)} ];
  const total = [0,1].map(i=>rows.reduce((sum,r)=>sum+(r.range?.[i] ?? 0),0));
  return {rows,total,perDay:total.map(v=>v/days),flightsIncluded:Boolean(flight)};
}