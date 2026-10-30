/**
 * The only place the app-shell service worker is registered.
 * Never registers in dev, iframes, or Lovable preview hosts; unregisters stale ones there.
 */
const SW_URL = "/sw.js";

function isPreviewHost(host: string): boolean {
  const label = host.split(".")[0] ?? "";
  const lovableHost = /\.(lovable\.app|gpt-eng\.com|gptengineer\.run)$/.test(host);
  if (lovableHost && /^(?:id-preview|preview)(?:-[a-z0-9]+)?--.+$/.test(label)) return true;
  if (lovableHost && /^project--.+-dev$/.test(label)) return true;
  return (
    host === "lovableproject.com" ||
    host.endsWith(".lovableproject.com") ||
    host === "lovableproject-dev.com" ||
    host.endsWith(".lovableproject-dev.com") ||
    host === "beta.lovable.dev" ||
    host.endsWith(".beta.lovable.dev")
  );
}

async function unregisterAppWorkers() {
  const regs = await navigator.serviceWorker.getRegistrations();
  await Promise.all(
    regs.filter((r) => r.active?.scriptURL.endsWith(SW_URL) || r.installing?.scriptURL.endsWith(SW_URL)).map((r) => r.unregister()),
  );
}

export function registerAppServiceWorker() {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;
  const host = window.location.hostname.toLowerCase();
  let inIframe = true;
  try {
    inIframe = window.self !== window.top;
  } catch {
    /* cross-origin parent: treat as iframe */
  }
  const refused =
    !import.meta.env.PROD ||
    inIframe ||
    isPreviewHost(host) ||
    new URLSearchParams(window.location.search).get("sw") === "off";
  if (refused) {
    void unregisterAppWorkers().catch(() => {});
    return;
  }
  void navigator.serviceWorker.register(SW_URL).catch(() => {});
}
