import { describe, expect, it } from "vitest";
import { isAppleMobile, providerOrder, safeRedirect } from "./device";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const IPAD_DESKTOP = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";
const ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";

describe("Apple sign-in on Apple phones", () => {
  it("detects an iPhone", () => expect(isAppleMobile(IPHONE)).toBe(true));
  it("detects an iPad in desktop mode by its touch screen", () => expect(isAppleMobile(IPAD_DESKTOP, 5)).toBe(true));
  it("does not treat a Mac without touch as a phone", () => expect(isAppleMobile(IPAD_DESKTOP, 0)).toBe(false));
  it("does not treat Android as Apple", () => expect(isAppleMobile(ANDROID, 5)).toBe(false));
  it("puts Apple first on iPhone", () => expect(providerOrder(true)[0]).toBe("apple"));
  it("puts Google first elsewhere but still offers Apple", () => {
    expect(providerOrder(false)[0]).toBe("google");
    expect(providerOrder(false)).toContain("apple");
  });
});

describe("return path after sign-in", () => {
  it("keeps same-origin paths", () => expect(safeRedirect("/preflight?from=CRA")).toBe("/preflight?from=CRA"));
  it("rejects other websites", () => {
    expect(safeRedirect("https://evil.example")).toBe("/account");
    expect(safeRedirect("//evil.example")).toBe("/account");
  });
  it("never loops back to the sign-in page", () => expect(safeRedirect("/auth")).toBe("/account"));
});
