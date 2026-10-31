/** Pure helpers for the account screens (no browser access at import time). */

export type Provider = "apple" | "google" | "lovable";

/** iPhone, iPod or iPad — including iPadOS, which reports itself as a Mac with touch. */
export function isAppleMobile(userAgent: string, maxTouchPoints = 0) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return true;
  return /Macintosh/i.test(userAgent) && maxTouchPoints > 1;
}

/** Apple ID goes first on iPhone/iPad; elsewhere Google leads and Apple is still offered. */
export function providerOrder(appleDevice: boolean): Provider[] {
  return appleDevice ? ["apple", "google", "lovable"] : ["google", "apple", "lovable"];
}

/** Only same-origin paths are allowed as the place to return to after sign-in. */
export function safeRedirect(value: unknown, fallback = "/account") {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (value.startsWith("/auth")) return fallback;
  return value.slice(0, 500);
}

export const AFTER_LOGIN_KEY = "flywell:after-login";
export const OPEN_PREFLIGHT_KEY = "flywell:open-preflight";
export const CHOSEN_FLIGHT_KEY = "flywell:chosen-flight";
