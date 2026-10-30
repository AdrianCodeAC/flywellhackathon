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
- [ ] Sections 4-6 (rides, visit, AI) — must follow sections 8+9 (RO Wikipedia via wikidata, AI translation of Wikivoyage, AI answers in selected language)
- [ ] Remove the temporary "Route to city center" test button once section 4 is in
- [ ] Finish the rest of Arrival Assistant per uploaded brief (Now_finish_the_rest...md)
  - [ ] A: VisitList (Overpass via proxy, Wikipedia RO/EN summaries, prefetch)
  - [ ] B: RideOptions (Nominatim destination, Uber/Bolt/Taxi estimate, Wikivoyage + AI RO translation, stations) + remove test button
  - [ ] C: AskAI (backend AI, context, places cards, persistent chat)
  - [ ] D: Cleanup, all 4 cards live, per-source errors, tests, EN/RO 375px review
