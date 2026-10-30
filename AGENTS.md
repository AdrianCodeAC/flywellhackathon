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
- Arrival Assistant lives in src/features/arrival (types, single services.ts for all external APIs, components); route is src/routes/arrival.tsx. Why: spec requires one reusable service layer.
- Airport dataset is a compact static file at public/data/airports.json ([iata,name,city,countryISO,lat,lon]), fetched lazily. Why: keeps the JS bundle small while staying keyless/offline-friendly.
- All visible Arrival text comes from src/locales/{en,ro}.json via react-i18next (src/lib/i18n.ts); i18n starts in "en" and the saved/phone language is applied in AppHeader's effect after hydration. Why: avoids SSR hydration mismatches.
- Offline/PWA: vite-plugin-pwa generateSW writes sw.js into dist/client; registration only via src/lib/pwa-register.ts (refuses dev/preview/iframe). Manifest is hand-written in public/manifest.webmanifest. Why: preview safety and SSR has no index.html.
- Formatting helpers (formatDistance/formatDuration/formatOpeningHours) take a locale and use Intl. Why: spec requires locale-aware output.

- Arrival chat is one in-memory session held by the arrival page; switching sections preserves messages, changing airport resets them. Why: the brief requests continuity between sections, not saved conversations.
- Live content uses services.ts as the client entry point with server-only gateway and cache helpers behind server functions. Why: credentials stay private and storage can change in one service layer.
- Destination clocks use coordinate-to-IANA lookup and Intl rather than longitude offsets. Why: legal time zones and daylight saving affect practical arrival advice.
