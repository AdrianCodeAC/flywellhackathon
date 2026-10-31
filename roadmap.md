# Roadmap

- [x] Save Arrival Assistant spec
- [x] /arrival page, shared types, services (airports), AirportSearch + chip + ?iata=
- [x] App opens on /arrival (home redirects)
- [x] Section 2: action sheet — bottom sheet on mobile, modal on desktop, 4 cards ("coming soon" until 3-6 land)
- [x] Section 7: shared RouteMap — Leaflet + OSM tiles, OSRM polyline, summary bar, Google/Apple Maps buttons, back button
- [x] Temporary "Route to city center" test button (geocodeCityCenter in services)
- [x] Section 3: FoodList (Overpass + 24h cache, area toggle, filters, Show route)
- [x] Spec sections 8 (mobile/PWA) + 9 (EN/RO) added and applied to sections 1, 2, 3, 7
- [x] Food list speed: backend proxy + shared 24h cache, mirror race, light query, prefetch
- [x] Sections 4-6 (rides, visit, AI) — must follow sections 8+9 (RO Wikipedia via wikidata, AI translation of Wikivoyage, AI answers in selected language)
- [x] Remove the temporary "Route to city center" test button once section 4 is in
- [x] Finish the rest of Arrival Assistant per uploaded brief (Now_finish_the_rest...md)
  - [x] A: VisitList (Overpass via proxy, Wikipedia RO/EN summaries, prefetch)
  - [x] B: RideOptions (Nominatim destination, Uber/Bolt/Taxi estimate, Wikivoyage + AI RO translation, stations) + remove test button
  - [x] C: AskAI (backend AI, context, places cards, persistent chat)
  - [x] D: Cleanup, all 4 cards live, per-source errors, tests, EN/RO 375px review
- [x] Replace primary food/sight sources with Nominatim/Wikipedia; 24h caches, 8s Overpass fallback, HTTP logging.
- [x] Measure CRA and BGY food and sights in EN/RO through the live app.

- [x] Default food area to city center.

- [x] Creative visual redesign: shared theme, arrival page, search and options, phone/desktop EN/RO verification.

- [x] Trip planner: spec, navigation, search, real flight API, AI advice, costs, extras, adjustment chat, 6h cache, EN/RO 375px tests.
- [ ] Verify account-saved adjustment chat end-to-end — waiting for a signed-in user; no auth users exist to mint a test session.
- [x] Update trip search: From/price-backed To, real price calendar and one-way, flight recommendations; verified CRA/OTP/BGY EN/RO at 375px and real CRA–BGY/CRA–MAD flows.
- Provider limits: absent cached price does not prove no flight; legacy route inventory misses CRA routes, so recent airport-exact direct fares supplement it. Price-drop groups remain hidden without a real historical baseline.
- [x] Make To free autocomplete with route hints; all-flights period page, sorting/filters/grouping, trip handoff; checked CRA/OTP 12–16 Nov EN/RO 375px (2 CRA fares, 18 OTP fares), real CRA–MAD handoff.

- [x] Before you fly: /preflight tab with a rule-based checklist (documents, security, baggage, timeline, customs, EU261) linked to official sources, AI trip-specific items, pre-flight agent chat, planner handoff; EN/RO 375px checked locally.
- [ ] Verify the pre-flight AI items and chat on the Lovable deployment (needs LOVABLE_API_KEY, not available locally).
- [x] Airport guide after the pre-flight checklist: only the steps this passenger needs (check-in/bag drop, security, passport control, gate; on arrival passport, baggage claim, customs, exit/transport), drawn on a virtual airport map from OpenStreetMap, saved on the phone for offline use.
- [x] In-flight help (panic) button: animated calm screen with breathing, show-to-crew card, symptom guide and on-device medical card; works in airplane mode.
