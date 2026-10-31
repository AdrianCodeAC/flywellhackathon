<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Rules
- Subdirectories (src/features/arrival, trip, preflight) have their own AGENTS.md; read it before changing files there.
- Features live in src/features/<name> (arrival, trip, preflight, airport, inflight, account, trips); routes in src/routes. Why: each flow stays isolated.
- Airport dataset is a compact static file at public/data/airports.json ([iata,name,city,countryISO,lat,lon]), fetched lazily. Why: small bundle, keyless and offline-friendly.
- All visible text comes from src/locales/{en,ro}.json via react-i18next (src/lib/i18n.ts); i18n starts in "en" and the saved/phone language is applied in AppHeader's effect after hydration. Why: avoids SSR hydration mismatches.
- Offline/PWA: vite-plugin-pwa generateSW writes sw.js into dist/client; registration only via src/lib/pwa-register.ts (refuses dev/preview/iframe). Manifest is hand-written in public/manifest.webmanifest. Why: preview safety and SSR has no index.html.
- Formatting helpers take a locale and use Intl. Why: locale-aware output.
- AI uses the Lovable gateway when LOVABLE_API_KEY exists, else Groq (GROQ_API_KEY in git-ignored .env.local) for local development. Why: the Lovable key is only available on the deployment.
- Colors are defined once in src/styles.css: a palette layer (--palette-*), then element roles (--ui-*), which feed the shadcn and feature tokens; components never set raw colors. Why: the owner restyles by editing a palette value or one element role.
- Airport guide (src/features/airport): journey.ts derives steps from the pre-flight rules; layouts come from one Nominatim [aeroway=terminal] search plus one OSM API map call, cached 30 days in content_cache and device localStorage. Why: Overpass is unreliable, the OSM API must be hit rarely, maps must open offline.
- In-flight help (src/features/inflight) opens only from the Help button in a trip's During tab, uses static locale content, never network or AI; the medical card is edited only on the account page (owner-scoped medical_cards row), mirrored to the phone, read-only in Help, never stores the seat, and wiped from the phone on sign-out. Why: works offline while health data stays private.
- Accounts (src/features/account): one session listener in TripAuthProvider; /auth and /reset-password are public, the account page is under the managed _authenticated gate; profiles and saved_trips are owner-scoped, saved items carry data.key (route + dates) so saving updates instead of duplicating; avatars sit in a private bucket via short-lived signed URLs. Why: public buckets are blocked and RLS keeps items private.
- My trips (src/features/trips): device-first localStorage list synced by AccountSync to saved_trips rows of kind "preflight"; each trip page has Before / During / On arrival tabs; the menu offers only My trips, Plan a trip and I already have a ticket; /arrival stays a direct entry. The During tab saves its own page and /trips into the service worker "pages" cache (src/lib/offline-pages.ts; navigations match ignoring the query) and preloads Help. Why: trips open in airplane mode yet follow the user across phones.
