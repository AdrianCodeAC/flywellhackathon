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
- [ ] Replace primary food/sight sources with Nominatim/Wikipedia; 24h caches, 8s Overpass fallback, HTTP logging.
- [ ] Measure CRA and BGY food and sights in EN/RO through the live app.

- [ ] Default food area to city center.
