import { describe, expect, it } from "vitest";
import { defaultTab, inputFromPlan, makeTrip, sortTrips, tripIdFor } from "./model";
import { accountCard, EMPTY_CARD, mergeAccountCard } from "@/features/inflight/medical-card";
import type { PreflightInput } from "@/features/preflight/rules";

const base: PreflightInput = {
  origin: { iata: "OTP", city: "Bucharest", countryCode: "RO" },
  destination: { iata: "LTN", city: "London", countryCode: "GB" },
  date: "2026-11-20",
  citizenship: "ro",
  bag: "cabin",
  airline: "",
  children: false,
  medication: false,
  pet: false,
  lang: "ro",
};
const today = new Date("2026-11-10T12:00:00Z");

describe("my trips", () => {
  it("the same route on the same day is one trip", () => {
    expect(tripIdFor(base)).toBe("OTP-LTN-2026-11-20");
    expect(makeTrip({ ...base, citizenship: "eu" }).id).toBe(makeTrip(base).id);
  });

  it("opens on Before you fly until the flight day, and On arrival after it", () => {
    expect(defaultTab({ input: base }, today)).toBe("before");
    expect(defaultTab({ input: { ...base, date: "2026-11-10" } }, today)).toBe("before");
    expect(defaultTab({ input: { ...base, date: "2026-11-09" } }, today)).toBe("arrival");
  });

  it("lists upcoming trips soonest first and past trips last", () => {
    const trip = (date: string) => ({ input: { ...base, date }, returnDate: null });
    const order = sortTrips([trip("2026-12-01"), trip("2026-10-01"), trip("2026-11-15"), trip("2026-09-01")], today).map((x) => x.input.date);
    expect(order).toEqual(["2026-11-15", "2026-12-01", "2026-10-01", "2026-09-01"]);
  });

  it("a planned flight becomes a trip on the flight's departure day", () => {
    const input = inputFromPlan({ origin: base.origin, destination: base.destination, departure: "2026-11-21T06:10:00+02:00", airline: "W6", children: 2, bag: true, lang: "en" });
    expect(input).toMatchObject({ date: "2026-11-21", airline: "W6", children: true, bag: "checked", citizenship: "eu" });
    expect(inputFromPlan({ origin: base.origin, destination: base.destination, departure: "2026-11-21", airline: "", children: 0, bag: false, lang: "en", previous: { citizenship: "other" } }).citizenship).toBe("other");
  });
});

describe("medical card", () => {
  it("the account never stores the seat, and the phone keeps its own seat", () => {
    expect(accountCard({ ...EMPTY_CARD, allergies: "peanuts", seat: "14C" }).seat).toBe("");
    const merged = mergeAccountCard({ ...EMPTY_CARD, seat: "14C", allergies: "old" }, { allergies: "peanuts", seat: "1A" });
    expect(merged).toMatchObject({ seat: "14C", allergies: "peanuts" });
  });
});
