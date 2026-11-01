import { describe, expect, it } from "vitest";
import { EXIT_ROWS, SITUATIONS, adviceFor, defaultSituation, inRanges } from "./seats";

describe("seat advice", () => {
  it("never suggests an exit row to someone travelling with a child", () => {
    const a = adviceFor("child");
    for (const row of EXIT_ROWS.filter((r) => r === 12 || r === 13)) expect(inRanges(row, a.rows)).toBe(false);
    expect(inRanges(12, a.avoid)).toBe(true);
  });
  it("keeps children away from the last rows, where turbulence injuries cluster", () => {
    expect(inRanges(30, adviceFor("child").avoid)).toBe(true);
  });
  it("never suggests an exit row to a passenger with reduced mobility", () => {
    const a = adviceFor("mobility");
    expect(inRanges(12, a.rows) || inRanges(13, a.rows)).toBe(false);
  });
  it("puts the smoothest ride over the wing, not at the back", () => {
    const a = adviceFor("turbulence");
    expect(inRanges(15, a.rows)).toBe(true);
    expect(inRanges(29, a.rows)).toBe(false);
  });
  it("considers both front and rear doors for quick disembarkation", () => {
    const a = adviceFor("quickExit");
    expect(a.rows).toEqual([[1, 5], [26, 30]]);
    expect(a.columns).toEqual(["aisle"]);
    expect(inRanges(30, a.avoid)).toBe(false);
    expect(inRanges(15, a.rows)).toBe(false);
  });
  it("opens on the child advice when children are on the trip", () => {
    expect(defaultSituation({ children: true })).toBe("child");
    expect(defaultSituation({ children: false })).toBe("turbulence");
  });
  it("never recommends a row it also says to avoid", () => {
    for (const a of SITUATIONS) for (let r = 1; r <= 30; r++) expect(inRanges(r, a.rows) && inRanges(r, a.avoid)).toBe(false);
  });
});
