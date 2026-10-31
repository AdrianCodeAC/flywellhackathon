/** Flight number, live status (AviationStack) and the two pre-flight reminders. */
import { z } from "zod";

/** "Wizz Air W6 3101" → "W63101". The last code-plus-number in the text wins. */
export function flightNumber(text: string): string | null {
  const matches = [...text.toUpperCase().matchAll(/\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\b/g)];
  const last = matches.at(-1);
  return last ? `${last[1]}${last[2]}` : null;
}

export const flightCodeSchema = z.string().regex(/^[A-Z0-9]{2}\d{1,4}$/);

export type FlightState = "scheduled" | "active" | "landed" | "cancelled" | "incident" | "diverted";

export interface FlightEnd {
  iata: string;
  terminal: string | null;
  gate: string | null;
  /** Local airport time, "HH:MM". */
  scheduled: string | null;
  estimated: string | null;
  delayMin: number;
}

export interface FlightStatus {
  state: FlightState;
  departure: FlightEnd;
  arrival: FlightEnd & { baggage: string | null };
}

export type FlightLookup =
  | { kind: "found"; status: FlightStatus }
  | { kind: "notFound" }
  | { kind: "unconfigured" }
  | { kind: "error" };

interface RawEnd {
  iata?: string | null;
  terminal?: string | null;
  gate?: string | null;
  baggage?: string | null;
  delay?: number | null;
  scheduled?: string | null;
  estimated?: string | null;
}
interface RawFlight {
  flight_date?: string;
  flight_status?: string;
  departure?: RawEnd;
  arrival?: RawEnd;
}

const STATES: FlightState[] = [
  "scheduled",
  "active",
  "landed",
  "cancelled",
  "incident",
  "diverted",
];
// AviationStack writes local airport time with a "+00:00" suffix, so the clock part is read as is.
const clock = (v: string | null | undefined) =>
  v && /T\d{2}:\d{2}/.test(v) ? v.slice(11, 16) : null;

function end(raw: RawEnd | undefined): FlightEnd {
  return {
    iata: raw?.iata ?? "",
    terminal: raw?.terminal || null,
    gate: raw?.gate || null,
    scheduled: clock(raw?.scheduled),
    estimated: clock(raw?.estimated),
    delayMin: Math.max(0, Math.round(raw?.delay ?? 0)),
  };
}

/** The flight on `date` from an AviationStack /v1/flights response. */
export function parseFlightStatus(body: unknown, date: string): FlightStatus | null {
  const data = (body as { data?: RawFlight[] } | null)?.data;
  const flight = Array.isArray(data) ? data.find((f) => f.flight_date === date) : undefined;
  if (!flight) return null;
  const state = STATES.find((s) => s === flight.flight_status) ?? "scheduled";
  return {
    state,
    departure: end(flight.departure),
    arrival: { ...end(flight.arrival), baggage: flight.arrival?.baggage || null },
  };
}

/** Live data exists only around the flight day, so other days skip the (quota-limited) lookup. */
export function isLiveWindow(date: string, today = new Date()): boolean {
  const day = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10));
  const now = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  const diff = (day - now) / 86_400_000;
  return diff >= -1 && diff <= 1;
}

/** Departure as an instant: local "HH:MM" at the origin, shifted by its UTC offset in hours. */
export function departureInstant(date: string, time: string, offsetHours: number): Date {
  const [h = 0, m = 0] = time.split(":").map(Number);
  const utc = Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10), h, m);
  return new Date(utc - offsetHours * 3_600_000);
}

export type ReminderKind = "checkIn" | "leave";
export interface Reminder {
  kind: ReminderKind;
  at: Date;
  /** For "leave": when to set off, as an instant. */
  leaveAt?: Date;
}

/**
 * Check-in: 24 h before departure, when nearly every airline's online check-in is open.
 * Leave: 30 min before the passenger should set off to be at the airport `arriveHours`
 * before departure, given `travelMin` to get there.
 */
export function reminders(departure: Date, arriveHours: number, travelMin: number): Reminder[] {
  const leaveAt = new Date(departure.getTime() - arriveHours * 3_600_000 - travelMin * 60_000);
  return [
    { kind: "checkIn", at: new Date(departure.getTime() - 24 * 3_600_000) },
    { kind: "leave", at: new Date(leaveAt.getTime() - 30 * 60_000), leaveAt },
  ];
}

const icsTime = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
const icsText = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");

/** A calendar file whose alarms ring even when the app is closed. */
export function remindersIcs(
  uid: string,
  items: { at: Date; title: string; body: string }[],
  now = new Date(),
): string {
  const events = items.flatMap((item, i) => [
    "BEGIN:VEVENT",
    `UID:${uid}-${i}@flywell`,
    `DTSTAMP:${icsTime(now)}`,
    `DTSTART:${icsTime(item.at)}`,
    `DTEND:${icsTime(new Date(item.at.getTime() + 15 * 60_000))}`,
    `SUMMARY:${icsText(item.title)}`,
    `DESCRIPTION:${icsText(item.body)}`,
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    `DESCRIPTION:${icsText(item.title)}`,
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT",
  ]);
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Flywell//Reminders//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
