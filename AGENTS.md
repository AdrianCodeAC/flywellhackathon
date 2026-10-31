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

- Food uses bounded Nominatim category searches and sights use language-keyed Wikipedia GeoSearch, with versioned 24h device/shared caches and Overpass only after primary-source failure. Why: live Overpass capacity is unreliable.
- Nominatim calls are serialized at one-second intervals within each running service instance; public deployment needs a centralized queue for a cross-instance guarantee. Why: the public provider limit applies across users.

- Shared arrival option tiles live in ArrivalOptions and are reused on the page and in the dialog; travel visual roles are centralized in styles.css. Why: keeps navigation styling consistent without changing data services.
- Trip planning lives in src/features/trip with server-only external integrations, progressive NDJSON search and AI SDK chat streams; public UI starts at index while /arrival remains a direct entry. Why: isolates planning from existing arrival behaviour.
- Trip conversations use one owner-scoped row per user and authenticated access; trip search caches store only public destination advice, never chat messages. Why: protects private discussions while sharing nonpersonal searches.
- Trip discovery uses server functions for airport-exact fare validation, route inventory, price calendars and city thumbnails; pure discovery rules are independently tested. Why: cached metro-city fares cannot prove a route from a particular airport.
- One-way inputs set returnDate equal to departure as a transport sentinel; UI omits return and shows only daily non-flight estimates. Why: preserves the existing trip-agent input contract without inventing a stay length.
- All-flight browsing has a dedicated /flights route; selecting a fare hands a validated input to the planner through origin-scoped session storage and a runTrip navigation flag. Why: preserves the search fields while keeping the results page independently navigable.

- Pre-flight lives in src/features/preflight; rules.ts builds the checklist deterministically and only cites the hand-checked SOURCES catalogue; the AI adds at most 6 marked items and may cite sources only by id. Why: official-regulation advice must not depend on the AI or on model-invented URLs.
