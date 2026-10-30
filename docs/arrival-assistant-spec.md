Add a new feature module called "Arrival Assistant" to the existing app. Build it as its own route/page (/arrival) with reusable components, and don't change the existing pages or styles. Match the app's current design system. Mobile-first.

## 1. Airport input with autocomplete
- A search field: "Where did you land?"
- Autocomplete as the user types (after 2 characters, debounced). Match by IATA code (e.g. "LIS"), airport name, or city.
- Use a static airport dataset bundled with the app (e.g. the open OurAirports / mwgg "airports.json" data, filtered to airports with an IATA code) so suggestions are instant and work offline. Each entry needs: IATA, name, city, country, lat, lon.
- Each suggestion shows: "LIS · Humberto Delgado Airport, Lisbon, Portugal".
- On selection, show the chosen airport + city as a chip, save it in app state (and localStorage), and open the action popup.
- The module should also accept an airport passed in from elsewhere in the app (prop or URL param ?iata=LIS). If one is provided, skip straight to the popup.

## 2. Action popup (bottom sheet on mobile, modal on desktop)
Title: "Welcome to {city}! What do you need?"
Four large tappable cards with icons:
1. 🍔 Hungry?
2. 🚕 Need a ride?
3. 🏛️ What to visit?
4. 💬 Ask anything (text input)

## 3. Hungry?
- Query the Overpass API (OpenStreetMap, free, no key) for amenity=restaurant, fast_food, cafe.
- Toggle at the top: "Near the airport" (3 km radius around the airport) / "In {city} center" (2 km around the city center coordinates).
- Filter chips: All · Restaurants · Fast food · Cafés · Open now.
- List cards: name, type, cuisine (if available), distance, opening hours (if available), "Open now" badge when it can be parsed.
- Sort by distance. Show at most 30 results. Show loading skeletons and a friendly empty state.

## 4. Need a ride?
Show a destination field first ("Where are you going?" with Nominatim geocoding autocomplete, defaulting to "{city} center"). Then show option cards:
- Uber: button opening the Uber universal deep link with pickup = airport coords and dropoff = destination coords (https://m.uber.com/ul/?action=setPickup&pickup[latitude]=..&pickup[longitude]=..&dropoff[latitude]=..&dropoff[longitude]=..).
- Bolt: button that opens the Bolt app/website.
- Taxi: estimated time and distance from OSRM (public router.project-osrm.org, driving profile), plus a rough price range clearly labeled "Estimate".
- Public transport (bus/train/metro): fetch the city's Wikivoyage page (MediaWiki API, origin=*) and show the "Get in → By plane" section as clean, readable text. Also list nearby bus stops/train stations around the airport from Overpass (public_transport=station, highway=bus_stop, railway=station within 1.5 km).
Each card shows: icon, name, estimated time, estimated cost (if known), and a "Show route" button.

## 5. What to visit?
- Query Overpass within 10 km of the city center for tourism=museum, tourism=attraction, historic=monument, historic=castle, tourism=viewpoint, tourism=gallery.
- Filter chips: All · Museums · Monuments · Viewpoints · Other.
- Card: name, category, distance from the airport, short description or Wikipedia link when the OSM tags include wikipedia/wikidata (fetch the summary from the Wikipedia REST API for the top 10).
- Rank results that have a Wikipedia link first.

## 6. Ask anything (AI)
- Text input + send button: "Ask anything about {city}…" with example chips ("Cheap dinner open late", "Fastest way to the old town", "What can I do in 4 hours?").
- Send the question to a backend AI function along with context: airport, city, current local time at the destination, and the results already loaded (restaurants, places, transport). Never call an AI provider directly from the browser or expose keys.
- System instruction for the AI: "You are a travel assistant for someone who just landed. Be concise and practical. When recommending specific places, prefer places from the provided data. Return your answer as text plus an optional JSON list of recommended places with name, lat, lon so they can be shown on the map."
- Show the answer in a chat bubble. Any places it returns appear as tappable cards with "Show route".

## 7. Map + route view (shared by all sections)
- Every result card (restaurant, ride option, attraction, AI place) has a "Show route" action that opens a shared map view.
- Use Leaflet with OpenStreetMap tiles (no API key).
- Markers: airport (start) and selected place (destination). Draw the route polyline from OSRM. Use the driving profile by default, with a toggle for walking/driving when the distance is under 3 km.
- Show a summary bar: distance, estimated duration, plus buttons "Open in Google Maps" and "Open in Apple Maps" (deep links with the destination coordinates).
- On mobile, the map is full screen with a back button to return to the list without losing scroll position or filters.

## Technical requirements
- Put the API calls in a single service file (airports, overpass, nominatim, osrm, wikivoyage, wikipedia, ai) so other parts of the app can reuse them.
- Cache Overpass/Wikivoyage responses per city in memory and localStorage for 24h.
- Respect public API rules: send a descriptive User-Agent/Referer for Nominatim, max 1 Nominatim request per second, debounce all autocomplete.
- Handle errors on each API separately: if one source fails, show "Couldn't load this right now — retry" on that section only.
- Use TypeScript types for Airport, Place, TransportOption, Route.
- All text in English. Keep components small and named clearly (AirportSearch, ArrivalActionSheet, FoodList, RideOptions, VisitList, AskAI, RouteMap).