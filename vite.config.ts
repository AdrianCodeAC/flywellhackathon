// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [
      VitePWA({
        // Registration happens only in src/lib/pwa-register.ts (guarded against preview/dev).
        injectRegister: null,
        registerType: "autoUpdate",
        strategies: "generateSW",
        filename: "sw.js",
        // Write into the client output that is actually served.
        outDir: "dist/client",
        // public/manifest.webmanifest is hand-written and linked from __root.
        manifest: false,
        devOptions: { enabled: false },
        workbox: {
          globDirectory: "dist/client",
          globPatterns: ["**/*.{js,css,png,svg,ico,webmanifest,woff2}", "data/airports.json"],
          navigateFallback: null,
          cleanupOutdatedCaches: true,
          runtimeCaching: [
            {
              urlPattern: ({ request, url }) => request.mode === "navigate" && !url.pathname.startsWith("/~oauth"),
              handler: "NetworkFirst",
              options: { cacheName: "pages", networkTimeoutSeconds: 4, expiration: { maxEntries: 20 } },
            },
            {
              urlPattern: ({ url }) => url.pathname === "/data/airports.json",
              handler: "StaleWhileRevalidate",
              options: { cacheName: "airports" },
            },
            {
              urlPattern: ({ url }) => url.hostname === "tile.openstreetmap.org",
              handler: "CacheFirst",
              options: {
                cacheName: "map-tiles",
                expiration: { maxEntries: 400, maxAgeSeconds: 7 * 24 * 3600 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
          ],
        },
      }),
    ],
  },
});
