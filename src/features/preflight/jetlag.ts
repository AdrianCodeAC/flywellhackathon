/**
 * Jet-lag plan from the legal time-zone difference on the flight date. Follows
 * the usual circadian-shifting advice: shift sleep about an hour a day before
 * flying, then time light exposure at the destination (morning light after
 * flying east, evening light after flying west).
 */

/** UTC offset in hours of an IANA zone on a given date (handles daylight saving). */
export function utcOffset(timeZone: string, date: Date): number {
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "longOffset" })
      .formatToParts(date)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return 0;
  const hours = Number(m[2]) + Number(m[3] ?? 0) / 60;
  return m[1] === "-" ? -hours : hours;
}

export type Direction = "none" | "east" | "west";

export interface JetLagPlan {
  /** Signed difference destination − origin, in hours. */
  difference: number;
  /** Hours the body clock has to move, after picking the easier direction. */
  shift: number;
  direction: Direction;
  /** Days to start shifting sleep before departure (0–3). */
  prepDays: number;
  /** Rough days to adapt after arrival. */
  recoveryDays: number;
}

export function jetLagPlan(originZone: string, destinationZone: string, date: Date): JetLagPlan {
  const difference = utcOffset(destinationZone, date) - utcOffset(originZone, date);
  // Beyond 12 h it is easier to delay the clock (go "west") the other way round.
  let shift = Math.abs(difference);
  let direction: Direction = difference > 0 ? "east" : "west";
  if (shift > 12) {
    shift = 24 - shift;
    direction = direction === "east" ? "west" : "east";
  }
  if (shift < 2) return { difference, shift, direction: "none", prepDays: 0, recoveryDays: 0 };
  return {
    difference,
    shift,
    direction,
    prepDays: Math.min(3, Math.ceil(shift / 2)),
    // About a day per hour eastward; the clock delays more easily westward.
    recoveryDays: Math.max(1, Math.round(direction === "east" ? shift : shift / 1.5)),
  };
}
