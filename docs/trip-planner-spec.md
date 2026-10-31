Add a new "Plan a trip" feature to Flywell. Save this spec as docs/trip-planner-spec.md first, then build it. Follow the existing design, the EN/RO translations (sections 8 and 9 of the arrival spec) and the mobile-first rules. Don't break the Arrival Assistant.

## 1. Navigation
- Two tabs at the top (or a bottom tab bar on phones): "Plan a trip" (default, opens first) and "I already have a ticket" (the existing Arrival Assistant).
- The choice is remembered. If the user picks a flight in Plan a trip, offer a button "Set as my arrival" that switches to the Arrival tab with the destination airport pre-filled.

## 2. The search (as simple as possible)
One card with three main fields and one big button:
- Where: free text with autocomplete for cities and airports ("Barcelona", "somewhere warm in November" also allowed; the AI interprets vague destinations and suggests 3 options).
- When: date range picker (departure + return) with a "Flexible ±3 days" toggle. Show the number of nights automatically.
- Who: stepper for adults and children (default 1 adult).
- Optional, collapsed under "More options": departure airport (default CRA, or nearest airport from GPS), budget level (Budget / Medium / Comfort), direct flights only, checked bag.
- Button: "Find my trip" / "Găsește-mi călătoria".

## 3. Trip agent (backend AI function, never call AI or APIs from the browser)
Steps, shown to the user as a short animated progress list ("Searching flights… Finding places to stay… Estimating costs…"):
a) Flights: get real prices from the Travelpayouts / Aviasales Data API (token stored as a backend secret; ask me to add it). Search the chosen dates, and ±3 days if flexible. NEVER invent flight prices; if the API has no data, say so and show a prefilled Google Flights / Skyscanner link instead.
b) Rank flights by a "Flywell comfort score" combined with price: total duration, number of stops, layover length, departure/arrival hours (penalize 23:00–06:00). Show the best overall pick, the cheapest, and the most comfortable.
c) Accommodation: suggest 3 neighbourhoods/areas that fit the budget level and travellers (e.g. family, central, quiet), each with an estimated nightly price range clearly labelled "Estimate". Buttons open Booking.com and Airbnb searches prefilled with city, dates and number of guests.
d) Cost of the stay: estimate for the whole trip and per day, for the number of people and nights: flights (real price), accommodation (estimate range), food, local transport, activities. Show a total range and a simple breakdown bar. Everything except real flight prices is marked "Estimate".
e) Extras: weather for those dates (Open-Meteo, free, no key; climate averages if dates are far away), documents needed for Romanian citizens (ID card vs passport, visa), local currency and exchange rate, and 3 wellbeing tips (jet lag, hydration, rest on arrival).

## 4. Results screen (one scrollable page)
1. Summary header: "Craiova → Barcelona · 12–16 Nov · 4 nights · 2 adults" with an Edit button.
2. Flight cards: Best pick (highlighted), Cheapest, Most comfortable. Each shows airline, times, duration, stops, comfort score, price per person and total, and a "Book" button (deep link to the provider).
3. Where to stay: 3 area cards with estimated price range and Booking/Airbnb buttons.
4. Trip cost: total estimate with breakdown.
5. Good to know: weather, documents, currency, wellbeing tips.
6. "Ask the agent" chat at the bottom to adjust ("cheaper", "only direct flights", "a hotel near the beach"); the results update.

## 5. Quality rules
- Results within ~10 s; show partial results as soon as flights arrive.
- Cache searches for 6 h.
- Every text in en.json and ro.json; prices formatted in the user's currency (RON by default for Romanian, EUR otherwise).
- Each part fails on its own (e.g. no hotel data still shows flights).
- Test at 375px in both languages with CRA → BCN and CRA → BGY.

When done, tell me which secrets/accounts I need to add and what is real data vs estimate.