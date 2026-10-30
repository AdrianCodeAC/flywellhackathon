import { describe, expect, it } from "vitest";
import { buildOverpassQuery, raceMirrors, searchPlaces } from "./overpass.server";

const el = (i: number) => ({ type: "node", id: i, lat: 38.78 + i * 1e-4, lon: -9.13, tags: { name: `P${i}`, amenity: "cafe", extra: "x" } });

describe("overpass query", () => {
  it("is light: 12s timeout, named nodes+ways, 60 results, one amenity regex", () => {
    const q = buildOverpassQuery("food", 38.78, -9.13, 1500);
    expect(q).toContain("[timeout:12]");
    expect(q).toContain("out center tags 60;");
    expect(q).toContain('node["amenity"~"^(restaurant|fast_food|cafe)$"]["name"](around:1500,');
    expect(q).toContain('way["amenity"');
    expect(q).not.toContain("relation");
  });
});

describe("mirror race", () => {
  it("uses the first successful mirror and aborts the others", async () => {
    const aborted: string[] = [];
    const fake = ((url: string, init: RequestInit) =>
      new Promise((resolve, reject) => {
        init.signal?.addEventListener("abort", () => {
          aborted.push(url);
          reject(new Error("aborted"));
        });
        if (url === "b") setTimeout(() => resolve(new Response(JSON.stringify({ elements: [el(1)] }))), 10);
        if (url === "a") setTimeout(() => resolve(new Response("busy", { status: 504 })), 1);
      })) as unknown as typeof fetch;
    const out = await raceMirrors("q", fake, ["a", "b", "c"], 5000);
    expect(out).toHaveLength(1);
    expect(aborted).toContain("c");
  });

  it("gives up after the per-mirror timeout", async () => {
    const hang = ((_u: string, init: RequestInit) =>
      new Promise((_r, reject) => init.signal?.addEventListener("abort", () => reject(new Error("t"))))) as unknown as typeof fetch;
    await expect(raceMirrors("q", hang, ["a", "b"], 30)).rejects.toBeTruthy();
  });
});

describe("radius retry", () => {
  it("doubles the radius once when fewer than 8 results come back", async () => {
    const radii: string[] = [];
    const fake = ((_u: string, init: RequestInit) => {
      const q = decodeURIComponent(String(init.body));
      radii.push(/around:(\d+)/.exec(q)![1]!);
      const n = q.includes("around:1500") ? 3 : 12;
      return Promise.resolve(new Response(JSON.stringify({ elements: Array.from({ length: n }, (_, i) => el(i)) })));
    }) as unknown as typeof fetch;
    const res = await searchPlaces("food", 38.78, -9.13, 1500, fake);
    expect(res.radiusM).toBe(3000);
    expect(res.places).toHaveLength(12);
    expect(res.places[0]!.tags).not.toHaveProperty("extra");
  });
});
