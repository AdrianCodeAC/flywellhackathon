import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchOsrmRoute, geocodeCityCenter } from "./services";

const osrmBody = {
  code: "Ok",
  routes: [
    {
      distance: 8123,
      duration: 1200,
      geometry: { coordinates: [[-9.13, 38.72], [-9.14, 38.73]] },
    },
  ],
};

describe("fetchOsrmRoute", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("walks with the foot router (the OSRM demo only knows cars), lat/lon ordered correctly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => osrmBody });
    vi.stubGlobal("fetch", fetchMock);

    await fetchOsrmRoute([38.77, -9.13], [38.72, -9.14], "walking");

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("routing.openstreetmap.de/routed-foot/route/v1/foot/");
    expect(url).toContain("-9.13,38.77;-9.14,38.72");
  });

  it("drives with the OSRM car router", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => osrmBody });
    vi.stubGlobal("fetch", fetchMock);

    await fetchOsrmRoute([38.77, -9.13], [38.72, -9.14], "driving");

    expect(fetchMock.mock.calls[0]![0] as string).toContain("router.project-osrm.org/route/v1/driving/");
  });

  it("converts geojson [lon, lat] pairs into [lat, lon] and keeps distance/time", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => osrmBody }));

    const route = await fetchOsrmRoute([38.77, -9.13], [38.72, -9.14], "driving");

    expect(route.coordinates).toEqual([[38.72, -9.13], [38.73, -9.14]]);
    expect(route.distanceM).toBe(8123);
    expect(route.durationSec).toBe(1200);
    expect(route.profile).toBe("driving");
  });

  it("fails when OSRM returns no route", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ code: "NoRoute", routes: [] }) }),
    );

    await expect(fetchOsrmRoute([38.77, -9.13], [38.72, -9.14])).rejects.toThrow("OSRM returned no route");
  });
});

describe("geocodeCityCenter", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("picks the city's own boundary, not a town literally named 'Lisbon Center'", async () => {
    const rows = [
      {
        name: "Lisbon Center",
        display_name: "Lisbon Center, Kendall County, Illinois, United States",
        lat: "41.5244748",
        lon: "-88.4339589",
        category: "place",
      },
      {
        name: "Lisboa",
        display_name: "Lisboa, Portugal",
        lat: "38.7077507",
        lon: "-9.1365919",
        category: "administrative",
      },
    ];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => rows });
    vi.stubGlobal("fetch", fetchMock);

    const center = await geocodeCityCenter("Lisbon", "PT");

    expect(center?.name).toBe("Lisboa");
    expect(center?.lat).toBe(38.7077507);
    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("q=Lisbon");
    expect(url).toContain("countrycodes=pt");
    expect(url).not.toContain("center");
  });
});

describe("cached", async () => {
  const { cached, clearMemoryCache } = await import("./services");
  it("reuses a stored result within 24h and reloads after", async () => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    });
    let calls = 0;
    const load = async () => ++calls;
    expect(await cached("k", load)).toBe(1);
    clearMemoryCache();
    expect(await cached("k", load)).toBe(1); // from localStorage
    const realNow = Date.now;
    Date.now = () => realNow() + 25 * 3600 * 1000;
    clearMemoryCache();
    expect(await cached("k", load)).toBe(2);
    Date.now = realNow;
    vi.unstubAllGlobals();
  });
});
