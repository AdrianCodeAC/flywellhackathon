import { beforeEach, describe, expect, it } from "vitest";
import { allow, clientIp, guardRequest, isCrossSite, resetGuard } from "./request-guard";
import { CANONICAL_ORIGIN, trustedOrigin } from "./site-origin";
import { safeRedirect } from "@/features/account/device";

describe("rate limit", () => {
  beforeEach(resetGuard);

  it("allows up to the limit per window, then refuses", () => {
    expect([1, 2, 3].map(() => allow("ai:1.2.3.4", 3, 60_000, 1000))).toEqual([true, true, true]);
    expect(allow("ai:1.2.3.4", 3, 60_000, 2000)).toBe(false);
    expect(allow("ai:5.6.7.8", 3, 60_000, 2000)).toBe(true);
    expect(allow("ai:1.2.3.4", 3, 60_000, 62_000)).toBe(true);
  });

  it("answers 429 from API routes once the limit is reached", () => {
    const req = () =>
      new Request("https://flywellhackathon.lovable.app/api/trip", {
        method: "POST",
        headers: { "cf-connecting-ip": "9.9.9.9" },
      });
    expect(guardRequest(req(), "trip", 1)).toBeNull();
    expect(guardRequest(req(), "trip", 1)?.status).toBe(429);
  });

  it("reads the client address from proxy headers", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "1.1.1.1, 10.0.0.1" }))).toBe("1.1.1.1");
    expect(
      clientIp(new Headers({ "cf-connecting-ip": "2.2.2.2", "x-forwarded-for": "1.1.1.1" })),
    ).toBe("2.2.2.2");
  });
});

describe("cross-site requests", () => {
  it("blocks calls another website makes from the user's browser", () => {
    expect(isCrossSite(new Headers({ "sec-fetch-site": "cross-site" }))).toBe(true);
    expect(isCrossSite(new Headers({ "sec-fetch-site": "same-origin" }))).toBe(false);
    expect(isCrossSite(new Headers())).toBe(false);
    const res = guardRequest(
      new Request("https://x.test/api/trip", { headers: { "sec-fetch-site": "cross-site" } }),
      "trip",
      10,
    );
    expect(res?.status).toBe(403);
  });
});

describe("trusted origin", () => {
  it("keeps our own hosts", () => {
    expect(trustedOrigin("https://flywellhackathon.lovable.app/_serverFn/x")).toBe(
      "https://flywellhackathon.lovable.app",
    );
    expect(trustedOrigin("http://localhost:8080/x")).toBe("http://localhost:8080");
    expect(
      trustedOrigin("https://id-preview--81aa245e-d328-43c6-a930-732c5b1275d4.lovable.app/x"),
    ).toBe("https://id-preview--81aa245e-d328-43c6-a930-732c5b1275d4.lovable.app");
  });

  it("ignores a forged Host header", () => {
    expect(trustedOrigin("https://evil.example/_serverFn/x")).toBe(CANONICAL_ORIGIN);
    expect(trustedOrigin("https://someone-else.lovable.app/x")).toBe(CANONICAL_ORIGIN);
    expect(trustedOrigin("not a url")).toBe(CANONICAL_ORIGIN);
  });
});

describe("sign-in redirect", () => {
  it("refuses paths a browser would turn into another host", () => {
    expect(safeRedirect("/\t/evil.example")).toBe("/account");
    expect(safeRedirect("/\\evil.example")).toBe("/account");
    expect(safeRedirect("/trips\n//evil.example")).toBe("/account");
    expect(safeRedirect("/trips/CRA-BGY-2026-11-01?tab=before")).toBe(
      "/trips/CRA-BGY-2026-11-01?tab=before",
    );
  });
});
