# Arrival Assistant rules
- Single services.ts is the client entry point for all external APIs, with server-only gateway and cache helpers behind server functions. Why: one reusable service layer; credentials stay private.
- ArrivalAssistant holds the page logic; /arrival wraps it with banner and search, trips embed it fixed to the destination. Shared option tiles live in ArrivalOptions (page and dialog).
- Arrival chat is one in-memory session; switching sections keeps messages, changing airport resets them. Why: continuity between sections, not saved conversations.
- Destination clocks use coordinate-to-IANA lookup and Intl, not longitude offsets. Why: legal time zones and DST.
- Food uses bounded Nominatim category searches (widened once when nearly empty); sights use per-kind Wikidata search (haswbstatement + nearcoord, notability-ranked, interleaved by kind) with Wikipedia intros/coordinates, filled from filtered Wikipedia GeoSearch in small towns; versioned 24h device/shared caches, Overpass only after primary-source failure. Why: the nearest articles are streets and stations, SPARQL is too slow, Overpass is unreliable.
- Nominatim calls are serialized at one-second intervals per service instance; public deployment needs a centralized queue for a cross-instance guarantee. Why: the provider limit applies across users.
