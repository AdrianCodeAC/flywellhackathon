import { describe, expect, it } from "vitest";
import { appleMapsUrl, formatDistance, formatDuration, googleMapsUrl } from "./map-links";

const lisbon = { lat: 38.7223, lon: -9.1393 };
const airport = { lat: 38.7742, lon: -9.1342 };

describe("map deep links", () => {
  it("builds a Google Maps directions link with both endpoints", () => {
    const url = googleMapsUrl(lisbon, airport);
    expect(url).toContain("https://www.google.com/maps/dir/?api=1");
    expect(url).toContain("destination=38.7223,-9.1393");
    expect(url).toContain("origin=38.7742,-9.1342");
    expect(url).toContain("travelmode=driving");
  });

  it("builds an Apple Maps directions link with both endpoints", () => {
    const url = appleMapsUrl(lisbon, airport);
    expect(url).toContain("https://maps.apple.com/");
    expect(url).toContain("daddr=38.7223,-9.1393");
    expect(url).toContain("saddr=38.7742,-9.1342");
    expect(url).toContain("dirflg=d");
  });

  it("omits the origin when only a destination is known", () => {
    expect(googleMapsUrl(lisbon)).not.toContain("origin=");
    expect(appleMapsUrl(lisbon)).not.toContain("saddr=");
  });
});

describe("summary formatting", () => {
  it("shows metres under a kilometre and kilometres above it", () => {
    expect(formatDistance(820)).toBe("820 m");
    expect(formatDistance(8123)).toBe("8.1 km");
  });

  it("shows minutes under an hour and hours above it", () => {
    expect(formatDuration(1200)).toBe("20 min");
    expect(formatDuration(4500)).toBe("1 hr 15 min");
    expect(formatDuration(7200)).toBe("2 hr");
    expect(formatDuration(20)).toBe("<1 min");
  });
});

describe("Romanian formatting", () => {
  it("uses a decimal comma for kilometres", () => expect(formatDistance(8123, "ro")).toBe("8,1 km"));
  it("uses Romanian hour units", () => expect(formatDuration(4500, "ro")).toBe("1 oră 15 min."));
});
