import { describe, expect, it } from "vitest";
import { isOpenNow } from "./opening-hours";
// 2026-10-28 is a Wednesday.
const at = (d: number, h: number, m = 0) => new Date(2026, 9, d, h, m);
describe("isOpenNow", () => {
  it("24/7 is always open", () => expect(isOpenNow("24/7", at(28, 3))).toBe(true));
  it("weekday hours", () => {
    expect(isOpenNow("Mo-Fr 09:00-18:00", at(28, 10))).toBe(true);
    expect(isOpenNow("Mo-Fr 09:00-18:00", at(28, 19))).toBe(false);
    expect(isOpenNow("Mo-Fr 09:00-18:00", at(31, 10))).toBe(false);
  });
  it("overnight span carries into next day", () => {
    expect(isOpenNow("Tu 20:00-02:00", at(28, 1))).toBe(true);
    expect(isOpenNow("Tu 20:00-02:00", at(28, 3))).toBe(false);
  });
  it("off overrides", () => expect(isOpenNow("Mo-Su 09:00-17:00; We off", at(28, 10))).toBe(false));
  it("unknown syntax is undefined", () => expect(isOpenNow("sunrise-sunset", at(28, 10))).toBeUndefined());
});

import { formatOpeningHours } from "./opening-hours";
describe("formatOpeningHours", () => {
  const labels = { alwaysOpen: "Deschis non-stop", closed: "închis" };
  it("translates day names and 'off'", () => {
    const out = formatOpeningHours("Mo-Fr 09:00-18:00; Su off", "ro", labels);
    expect(out).toContain("09:00–18:00");
    expect(out).toContain("închis");
    expect(out).not.toContain("Mo");
  });
  it("24/7 uses the label", () => expect(formatOpeningHours("24/7", "ro", labels)).toBe("Deschis non-stop"));
});
