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

  it("asks OSRM for the requested profile with lat/lon ordered correctly", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => osrmBody });
    vi.stubGlobal("fetch", fetchMock);

    await fetchOsrmRoute([38.77, -9.13], [38.72, -9.14], "walking");

    const url = fetchMock.mock.calls[0]![0] as string;
    expect(url).toContain("/route/v1/walking/");
    expect(url).toContain("-9.13,38.77;-9.14,38.72");
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
