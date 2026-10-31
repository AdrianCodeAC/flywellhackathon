/**
 * Hand-curated baggage allowances for airlines common from Romanian airports.
 * Collected October 2026 from the airlines' pages and cross-checked guides;
 * `verify` marks airlines whose published rules vary by route or conflict.
 * Always shown with a link to the airline's own page.
 */
export interface Bag {
  /** Max size in cm, e.g. "40 × 30 × 20". */
  size: string;
  kg?: number;
}

export interface Fare {
  id: string;
  /** Fare name as the airline sells it (not translated). */
  name: string;
  personal: Bag | null;
  cabin: Bag | null;
  /** Checked bag: weight(s) included, "paid" when it can only be added, null if not offered. */
  checked: string | null;
  /** Optional locale key under preflight.bags.note */
  note?: string;
}

export interface Airline {
  codes: string[];
  name: string;
  aliases: string[];
  url: string;
  verify?: boolean;
  fares: Fare[];
}

export const AIRLINES: Airline[] = [
  {
    codes: ["W6", "W4", "W9", "5W"],
    name: "Wizz Air",
    aliases: ["wizz"],
    url: "https://wizzair.com/en-gb/information-and-services/travel-information/baggage",
    fares: [
      {
        id: "basic",
        name: "Basic",
        personal: { size: "40 × 30 × 20" },
        cabin: null,
        checked: "paid",
      },
      {
        id: "priority",
        name: "WIZZ Priority",
        personal: { size: "40 × 30 × 20" },
        cabin: { size: "55 × 40 × 23", kg: 10 },
        checked: "paid",
      },
      {
        id: "checked",
        name: "Basic + 10–32 kg",
        personal: { size: "40 × 30 × 20" },
        cabin: null,
        checked: "10 / 20 / 26 / 32 kg",
        note: "asBought",
      },
    ],
  },
  {
    codes: ["FR", "RK", "AL", "RR"],
    name: "Ryanair",
    aliases: ["ryanair", "malta air", "buzz"],
    url: "https://help.ryanair.com/hc/en-us/articles/360017824658",
    fares: [
      {
        id: "basic",
        name: "Basic",
        personal: { size: "40 × 30 × 20" },
        cabin: null,
        checked: "paid",
      },
      {
        id: "priority",
        name: "Priority & 2 Cabin Bags",
        personal: { size: "40 × 30 × 20" },
        cabin: { size: "55 × 40 × 20", kg: 10 },
        checked: "paid",
      },
      {
        id: "plus",
        name: "Plus",
        personal: { size: "40 × 30 × 20" },
        cabin: null,
        checked: "20 kg",
      },
    ],
  },
  {
    codes: ["U2", "EC", "DS"],
    name: "easyJet",
    aliases: ["easyjet", "easy jet"],
    url: "https://www.easyjet.com/en/help/baggage/cabin-bag-and-hold-luggage",
    fares: [
      {
        id: "standard",
        name: "Standard",
        personal: { size: "45 × 36 × 20", kg: 15 },
        cabin: null,
        checked: "paid",
      },
      {
        id: "large",
        name: "Large cabin bag / easyJet Plus / FLEXI",
        personal: { size: "45 × 36 × 20", kg: 15 },
        cabin: { size: "56 × 45 × 25", kg: 15 },
        checked: "paid",
      },
    ],
  },
  {
    codes: ["RO"],
    name: "TAROM",
    aliases: ["tarom"],
    url: "https://www.tarom.ro/en/rezerva/travel-classes",
    fares: [
      {
        id: "light",
        name: "Economy Light",
        personal: null,
        cabin: { size: "55 × 40 × 20", kg: 8 },
        checked: null,
        note: "combined8",
      },
      {
        id: "economy",
        name: "Economy (Saver / Standard)",
        personal: null,
        cabin: { size: "55 × 40 × 20", kg: 8 },
        checked: "1 × 23 kg",
        note: "combined8",
      },
    ],
  },
  {
    codes: ["LH", "OS"],
    name: "Lufthansa / Austrian",
    aliases: ["lufthansa", "austrian"],
    url: "https://www.lufthansa.com/de/en/baggage-overview",
    verify: true,
    fares: [
      {
        id: "light",
        name: "Economy Light",
        personal: { size: "40 × 30 × 10" },
        cabin: { size: "55 × 40 × 23", kg: 8 },
        checked: null,
      },
      {
        id: "classic",
        name: "Economy Classic / Flex",
        personal: { size: "40 × 30 × 10" },
        cabin: { size: "55 × 40 × 23", kg: 8 },
        checked: "1 × 23 kg",
      },
    ],
  },
  {
    codes: ["TK"],
    name: "Turkish Airlines",
    aliases: ["turkish"],
    url: "https://www.turkishairlines.com/",
    verify: true,
    fares: [
      {
        id: "ecofly",
        name: "EcoFly",
        personal: null,
        cabin: { size: "55 × 40 × 23", kg: 8 },
        checked: "route",
        note: "route",
      },
      {
        id: "extrafly",
        name: "ExtraFly / FlexFly",
        personal: null,
        cabin: { size: "55 × 40 × 23", kg: 8 },
        checked: "route",
        note: "route",
      },
    ],
  },
];

/** Match by IATA carrier code ("W6", "W6 3101") or by name ("Wizz Air"). */
export function findAirline(text: string): Airline | undefined {
  const value = text.trim().toLowerCase();
  if (!value) return undefined;
  const code = value.match(/^([a-z0-9]{2})(?:\s*\d{1,4})?\b/)?.[1]?.toUpperCase();
  return (
    AIRLINES.find((a) => a.aliases.some((alias) => value.includes(alias))) ??
    (code ? AIRLINES.find((a) => a.codes.includes(code)) : undefined)
  );
}
