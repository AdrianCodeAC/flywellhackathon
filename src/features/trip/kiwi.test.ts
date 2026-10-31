import { describe, expect, it } from "vitest";
import { kiwiArgs, kiwiTime, parseKiwi, readStreamJson, type KiwiPayload } from "./kiwi";
import type { TripInput } from "./types";

const roundTrip: TripInput = {
  destination: "London", destinationIata: "LHR", origin: "OTP",
  departure: "2026-11-12", returnDate: "2026-11-16", adults: 2, children: 0,
  flexible: false, oneWay: false, budget: "medium", direct: false, bag: false, lang: "ro",
};

const leg = (from: string, to: string, out: string, back: string) => ({
  from, to,
  departureTime: `${out}T06:15:00`, arrivalTime: `${out}T18:00:00`,
  durationSeconds: 49500, stops: 1,
  segments: [
    { from, to: "ATH", departureTime: `${out}T06:15:00`, arrivalTime: `${out}T09:30:00`, carrierName: "Aegean Airlines", flightNumber: "A3 123" },
    { from: "ATH", to, departureTime: `${out}T11:00:00`, arrivalTime: `${out}T18:00:00`, carrierName: "Aegean Airlines", flightNumber: "A3 456" },
  ],
});

const payload: KiwiPayload = {
  currency: "RON",
  resultsCount: 3,
  itineraries: [
    {
      id: "a1", price: 2668, priceFormatted: "2668 RON", totalDurationSeconds: 82200,
      bookingUrl: "https://kiwi.com/u/abc",
      outbound: leg("OTP", "LHR", "2026-11-12", ""),
      inbound: { ...leg("LHR", "OTP", "2026-11-16", ""), durationSeconds: 32700 },
    },
    // A row with no fare is not a flight the traveller can buy: it must be dropped.
    { id: "a2", outbound: leg("OTP", "LHR", "2026-11-12", ""), inbound: leg("LHR", "OTP", "2026-11-16", "") },
  ],
};

describe("kiwiArgs", () => {
  it("sends dd/mm/yyyy, the party, the currency and price order", () => {
    const args = kiwiArgs(roundTrip, "RON");
    expect(args.flyFrom).toBe("OTP");
    expect(args.flyTo).toBe("LHR");
    expect(args.departureDate).toBe("12/11/2026");
    expect(args.returnDate).toBe("16/11/2026");
    expect(args.adults).toBe(2);
    expect(args.currency).toBe("RON");
    expect(args.sort).toBe("price");
  });
  it("drops the return date for a one-way trip and widens both legs when flexible", () => {
    expect(kiwiArgs({ ...roundTrip, oneWay: true, returnDate: "2026-11-12" }, "EUR").returnDate).toBeUndefined();
    const flexible = kiwiArgs({ ...roundTrip, flexible: true }, "EUR");
    expect(flexible.departureDateFlexDays).toBe(3);
    expect(flexible.returnDateFlexDays).toBe(3);
  });
  it("asks the service itself for nonstop sectors when the traveller wants direct only", () => {
    expect(kiwiArgs({ ...roundTrip, direct: true }, "EUR").max_sector_stopovers).toBe(0);
    expect(kiwiArgs(roundTrip, "EUR").max_sector_stopovers).toBeUndefined();
  });
});

describe("parseKiwi", () => {
  const parsed = parseKiwi(payload, roundTrip, "RON", "https://www.google.com/travel/flights?q=OTP-LHR");
  it("keeps only rows with a real fare", () => {
    expect(parsed).toHaveLength(1);
    expect(parsed[0]?.id).toBe("kiwi:a1");
  });
  it("turns the whole-party price into a per-person price", () => {
    expect(parsed[0]?.price).toBe(1334);
    // Three travellers pay the same total: the per-person figure follows the party size.
    expect(parseKiwi(payload, { ...roundTrip, adults: 3 }, "RON", "https://example.com")[0]?.price).toBe(889);
  });
  it("counts stopovers on both legs and keeps the real times", () => {
    expect(parsed[0]?.stops).toBe(2);
    expect(parsed[0]?.departure).toBe("2026-11-12T06:15");
    expect(parsed[0]?.arrival).toBe("2026-11-12T18:00");
    expect(parsed[0]?.returnDate).toBe("2026-11-16T06:15");
    expect(parsed[0]?.duration).toBe(1370);
    expect(parsed[0]?.layover).toBe(90);
    expect(parsed[0]?.airline).toBe("Aegean Airlines");
    expect(parsed[0]?.flightNumber).toBe("A3 123 + A3 456 + A3 123 + A3 456");
  });
  it("carries the service's own currency and booking link", () => {
    expect(parsed[0]?.currency).toBe("RON");
    expect(parsed[0]?.link).toBe("https://kiwi.com/u/abc");
    expect(parsed[0]?.live).toBe(true);
  });
  it("falls back to a search link when a row has no booking url", () => {
    const noLink = parseKiwi({ ...payload, itineraries: [{ ...payload.itineraries![0], bookingUrl: undefined }] }, roundTrip, "RON", "https://www.google.com/travel/flights?q=OTP-LHR");
    expect(noLink[0]?.link).toBe("https://www.google.com/travel/flights?q=OTP-LHR");
  });
  it("drops a round trip whose return leg is missing", () => {
    const outboundOnly = parseKiwi({ ...payload, itineraries: [{ ...payload.itineraries![0], inbound: undefined }] }, roundTrip, "RON", "https://example.com");
    expect(outboundOnly).toHaveLength(0);
    // The same row is a valid one-way flight.
    expect(parseKiwi({ ...payload, itineraries: [{ ...payload.itineraries![0], inbound: undefined }] }, { ...roundTrip, oneWay: true }, "RON", "https://example.com")).toHaveLength(1);
  });
  it("keeps only the dates the traveller asked for", () => {
    const late = { ...payload, itineraries: [{ ...payload.itineraries![0], outbound: leg("OTP", "LHR", "2026-11-20", "") }] };
    expect(parseKiwi(late, roundTrip, "RON", "https://example.com")).toHaveLength(0);
    // Flexible dates accept a shift of up to three days, and three days is exactly the limit.
    expect(parseKiwi(late, { ...roundTrip, flexible: true }, "RON", "https://example.com")).toHaveLength(0);
    const near = { ...payload, itineraries: [{ ...payload.itineraries![0], outbound: leg("OTP", "LHR", "2026-11-15", "") }] };
    expect(parseKiwi(near, { ...roundTrip, flexible: true }, "RON", "https://example.com")).toHaveLength(1);
    expect(parseKiwi(near, roundTrip, "RON", "https://example.com")).toHaveLength(0);
  });
  it("hides stopovers from a traveller who asked for direct flights", () => {
    expect(parseKiwi(payload, { ...roundTrip, direct: true }, "RON", "https://example.com")).toHaveLength(0);
    const nonstop = { ...payload, itineraries: [{ ...payload.itineraries![0], outbound: { ...leg("OTP", "LHR", "2026-11-12", ""), stops: 0 }, inbound: { ...leg("LHR", "OTP", "2026-11-16", ""), stops: 0 } }] };
    expect(parseKiwi(nonstop, { ...roundTrip, direct: true }, "RON", "https://example.com")[0]?.stops).toBe(0);
  });
  it("refuses a row whose times cannot be read", () => {
    expect(kiwiTime("12.11.2026")).toBeNull();
    expect(kiwiTime("2026-11-12T06:15:00")).toBe("2026-11-12T06:15");
    expect(parseKiwi({ currency: "RON", itineraries: [{ id: "x", price: 900, outbound: { departureTime: "sometime", arrivalTime: "later" }, inbound: { departureTime: "soon" } }] }, roundTrip, "RON", "https://example.com")).toHaveLength(0);
  });
});

describe("readStreamJson", () => {
  it("pulls the JSON out of the streamed answer", () => {
    expect(readStreamJson('event: message\ndata: {"ok":true}\n\n')).toEqual({ ok: true });
    expect(readStreamJson('{"ok":false}')).toEqual({ ok: false });
    expect(readStreamJson("data: not json\n\ndata: {\"ok\":true}")).toEqual({ ok: true });
    expect(readStreamJson("nothing usable")).toBeNull();
  });
});
