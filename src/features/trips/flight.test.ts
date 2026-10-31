import { describe, expect, it } from "vitest";
import {
  departureInstant,
  flightNumber,
  isLiveWindow,
  parseFlightStatus,
  reminders,
  remindersIcs,
} from "./flight";

describe("flight number", () => {
  it("reads it from the airline field", () => {
    expect(flightNumber("Wizz Air W6 3101")).toBe("W63101");
    expect(flightNumber("fr1234")).toBe("FR1234");
    expect(flightNumber("TAROM RO 301")).toBe("RO301");
    expect(flightNumber("Wizz Air")).toBeNull();
    expect(flightNumber("")).toBeNull();
  });
});

describe("live status", () => {
  const body = {
    data: [
      {
        flight_date: "2026-11-19",
        flight_status: "landed",
        departure: { iata: "CRA" },
        arrival: { iata: "BGY" },
      },
      {
        flight_date: "2026-11-20",
        flight_status: "active",
        departure: {
          iata: "CRA",
          terminal: null,
          gate: "3",
          delay: 25,
          scheduled: "2026-11-20T06:10:00+00:00",
          estimated: "2026-11-20T06:35:00+00:00",
        },
        arrival: {
          iata: "BGY",
          terminal: "1",
          gate: null,
          baggage: "4",
          delay: 10,
          scheduled: "2026-11-20T07:40:00+00:00",
          estimated: null,
        },
      },
    ],
  };

  it("picks the flight on the trip day and keeps local clock times", () => {
    expect(parseFlightStatus(body, "2026-11-20")).toEqual({
      state: "active",
      departure: {
        iata: "CRA",
        terminal: null,
        gate: "3",
        scheduled: "06:10",
        estimated: "06:35",
        delayMin: 25,
      },
      arrival: {
        iata: "BGY",
        terminal: "1",
        gate: null,
        scheduled: "07:40",
        estimated: null,
        delayMin: 10,
        baggage: "4",
      },
    });
    expect(parseFlightStatus(body, "2026-11-21")).toBeNull();
    expect(parseFlightStatus({ error: { code: "x" } }, "2026-11-20")).toBeNull();
  });

  it("only looks the flight up around the flight day", () => {
    const today = new Date(2026, 10, 20, 9);
    expect(isLiveWindow("2026-11-20", today)).toBe(true);
    expect(isLiveWindow("2026-11-21", today)).toBe(true);
    expect(isLiveWindow("2026-11-19", today)).toBe(true);
    expect(isLiveWindow("2026-11-23", today)).toBe(false);
  });
});

describe("reminders", () => {
  // 06:10 in Craiova (UTC+2 in November) is 04:10 UTC.
  const departure = departureInstant("2026-11-20", "06:10", 2);

  it("converts the local departure time", () => {
    expect(departure.toISOString()).toBe("2026-11-20T04:10:00.000Z");
  });

  it("reminds about check-in a day before and about leaving 30 min before setting off", () => {
    const [checkIn, leave] = reminders(departure, 2, 45);
    expect(checkIn).toMatchObject({ kind: "checkIn", at: new Date("2026-11-19T04:10:00Z") });
    expect(leave?.leaveAt?.toISOString()).toBe("2026-11-20T01:25:00.000Z");
    expect(leave?.at.toISOString()).toBe("2026-11-20T00:55:00.000Z");
  });

  it("writes a calendar file with alarms", () => {
    const ics = remindersIcs(
      "CRA-BGY-2026-11-20",
      [{ at: departure, title: "Leave, now", body: "ID; boarding pass" }],
      new Date("2026-11-01T00:00:00Z"),
    );
    expect(ics).toContain("DTSTART:20261120T041000Z");
    expect(ics).toContain("SUMMARY:Leave\\, now");
    expect(ics).toContain("DESCRIPTION:ID\\; boarding pass");
    expect(ics.match(/BEGIN:VALARM/g)).toHaveLength(1);
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
  });
});
