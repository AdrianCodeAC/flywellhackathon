/**
 * Abuse protection for public server endpoints: a per-IP sliding-window limit and a
 * cross-site check. AI calls, flight data and map lookups cost money or quota, so an
 * anonymous script must not be able to call them in a loop.
 *
 * Counters live in memory, so each server instance limits on its own. That stops
 * scripted loops from one client; a distributed attack needs the host's firewall.
 */
import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

const hits = new Map<string, number[]>();
const MAX_KEYS = 20_000;

export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

/** True when the call fits in `limit` calls per `windowMs` for this key, and counts it. */
export function allow(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    hits.set(key, recent);
    return false;
  }
  recent.push(now);
  hits.delete(key);
  hits.set(key, recent);
  // Oldest keys go first, so memory stays bounded however many clients call.
  while (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value as string);
  return true;
}

/**
 * A request another website made from the user's browser. Browsers send
 * Sec-Fetch-Site and scripts on other sites cannot change it.
 */
export function isCrossSite(headers: Headers): boolean {
  return headers.get("sec-fetch-site") === "cross-site";
}

export const RATE_LIMITED =
  "Too many requests, try again in a minute. / Prea multe cereri, încearcă din nou peste un minut.";

/** Server-function middleware: blocks cross-site calls and limits each IP to `limit` calls a minute. */
export const guard = (bucket: string, limit: number, windowMs = 60_000) =>
  createMiddleware({ type: "function" }).server(({ next }) => {
    const request = getRequest();
    if (isCrossSite(request.headers)) throw new Error("Forbidden");
    if (!allow(`${bucket}:${clientIp(request.headers)}`, limit, windowMs))
      throw new Error(RATE_LIMITED);
    return next();
  });

/** The same checks for plain API routes; returns the error response, or null to continue. */
export function guardRequest(
  request: Request,
  bucket: string,
  limit: number,
  key = clientIp(request.headers),
): Response | null {
  if (isCrossSite(request.headers)) return new Response("Forbidden", { status: 403 });
  if (!allow(`${bucket}:${key}`, limit, 60_000)) {
    return Response.json(
      { error: RATE_LIMITED },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }
  return null;
}

/** Only for tests. */
export const resetGuard = () => hits.clear();
