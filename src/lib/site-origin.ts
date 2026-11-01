/**
 * The origin the server may fetch its own static files from (/data/airports.json).
 * The request URL is built from the Host header, which a client can forge; trusting it
 * would make the server fetch an attacker's file and save it in the shared cache.
 */
export const CANONICAL_ORIGIN = "https://flywellhackathon.lovable.app";
const PROJECT_ID = "81aa245e-d328-43c6-a930-732c5b1275d4";

export function trustedOrigin(requestUrl: string): string {
  try {
    const url = new URL(requestUrl);
    const host = url.hostname;
    const local = host === "localhost" || host === "127.0.0.1" || host === "[::1]";
    const ours =
      host === "flywellhackathon.lovable.app" ||
      ((host.endsWith(".lovable.app") || host.endsWith(".lovableproject.com")) &&
        host.includes(PROJECT_ID));
    if (local || ours) return url.origin;
  } catch {
    /* not a URL: use the published site */
  }
  return CANONICAL_ORIGIN;
}
