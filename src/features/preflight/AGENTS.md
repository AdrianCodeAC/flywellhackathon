# Pre-flight rules
- rules.ts builds the checklist deterministically and only cites the hand-checked SOURCES catalogue; the AI adds at most 6 marked items and may cite sources only by id. Why: regulation advice must not depend on the AI or invented URLs.
- Boarding passes are decoded on the device (BarcodeDetector, else lazily loaded @zxing/library) and parsed as IATA BCBP; images never leave the browser. Airline bag rules are a hand-checked table in airlines.ts with the airline's official link. Why: no reliable free API; baggage advice must not be invented.
- Seat advice (seats.ts) is hand-checked situations on a generic 30-row cabin citing SEAT_SOURCES, no AI; no accident or injury statistics are shown. Why: advice must not be invented, and the owner finds safety figures morbid.
