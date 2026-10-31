/**
 * Hand-checked pet rules per airline, from each airline's own pet page
 * (collected October 2026). `verify` marks airlines whose published numbers
 * could only be partly confirmed. Texts live under preflight.pets.* in the locales.
 */
export type Species = "dog" | "cat" | "ferret" | "bird" | "turtle";

export interface PetPolicy {
  id: string;
  name: string;
  codes: string[];
  aliases: string[];
  url: string;
  /** Small pets in the cabin; kg is pet + carrier. null = not carried in the cabin. */
  cabin: { kg: number; size?: string; species: Species[] } | null;
  /** Pets in the hold as checked baggage, cargo only, or not at all. */
  hold: { kind: "yes"; kg?: number } | { kind: "cargo" } | { kind: "no" };
  /** Hours before departure the pet must be booked, when the airline publishes it. */
  noticeHours?: number;
  /** Locale keys under preflight.pets.note */
  notes: string[];
  verify?: boolean;
}

export const PET_POLICIES: PetPolicy[] = [
  {
    id: "wizz",
    name: "Wizz Air",
    codes: ["W6", "W4", "W9", "5W"],
    aliases: ["wizz"],
    url: "https://www.wizzair.com/en-gb/help-centre/booking-information-and-services/baggage/special-baggage",
    cabin: null,
    hold: { kind: "no" },
    noticeHours: 48,
    notes: ["assistWizz"],
  },
  {
    id: "ryanair",
    name: "Ryanair",
    codes: ["FR", "RK", "AL", "RR"],
    aliases: ["ryanair", "malta air", "buzz"],
    url: "https://help.ryanair.com/hc/en-us/articles/12890968181521-Does-Ryanair-carry-animals",
    cabin: null,
    hold: { kind: "no" },
    notes: ["assistRyanair"],
  },
  {
    id: "easyjet",
    name: "easyJet",
    codes: ["U2", "EC", "DS"],
    aliases: ["easyjet", "easy jet"],
    url: "https://www.easyjet.com/en/help/baggage/restricted-and-unusual-items",
    cabin: null,
    hold: { kind: "no" },
    noticeHours: 48,
    notes: ["assistApproval"],
  },
  {
    id: "ba",
    name: "British Airways",
    codes: ["BA"],
    aliases: ["british airways"],
    url: "https://www.britishairways.com/content/en/information/travel-assistance/travelling-with-pets",
    cabin: null,
    hold: { kind: "cargo" },
    notes: ["baCargo"],
  },
  {
    id: "tarom",
    name: "TAROM",
    codes: ["RO"],
    aliases: ["tarom"],
    url: "https://www.tarom.ro/en/passenger-information/about-your-trip/travelling-with-pets/in-aircraft-hold/",
    cabin: { kg: 8, size: "42 × 26 × 20", species: ["dog", "cat"] },
    hold: { kind: "yes", kg: 75 },
    noticeHours: 48,
    notes: ["taromA320", "snubHold"],
  },
  {
    id: "lufthansa",
    name: "Lufthansa",
    codes: ["LH"],
    aliases: ["lufthansa"],
    url: "https://www.lufthansa.com/us/en/travelling-with-animals",
    cabin: { kg: 8, size: "55 × 40 × 23", species: ["dog", "cat"] },
    hold: { kind: "yes" },
    noticeHours: 72,
    notes: ["payAtCheckin"],
  },
  {
    id: "austrian",
    name: "Austrian Airlines",
    codes: ["OS"],
    aliases: ["austrian"],
    url: "https://www.austrian.com/at/en/plan/special-requirements/travelling-with-animals",
    cabin: { kg: 8, species: ["dog", "cat"] },
    hold: { kind: "yes" },
    notes: ["snubHold", "austrianBooking"],
    verify: true,
  },
  {
    id: "turkish",
    name: "Turkish Airlines",
    codes: ["TK"],
    aliases: ["turkish"],
    url: "https://www.turkishairlines.com/en-int/any-questions/traveling-with-pets/",
    cabin: { kg: 8, species: ["dog", "cat", "bird"] },
    hold: { kind: "yes" },
    notes: ["turkishHold"],
    verify: true,
  },
  {
    id: "klm",
    name: "KLM",
    codes: ["KL"],
    aliases: ["klm"],
    url: "https://www.klm.com/information/pets/reservation",
    cabin: { kg: 8, size: "46 × 28 × 24", species: ["dog", "cat"] },
    hold: { kind: "yes", kg: 75 },
    noticeHours: 48,
    notes: ["klmCabin"],
  },
  {
    id: "airfrance",
    name: "Air France",
    codes: ["AF"],
    aliases: ["air france"],
    url: "https://wwws.airfrance.fr/en/information/passagers/voyager-avec-son-animal-chien-chat",
    cabin: { kg: 8, size: "46 × 28 × 24", species: ["dog", "cat"] },
    hold: { kind: "yes", kg: 75 },
    noticeHours: 24,
    notes: [],
  },
  {
    id: "lot",
    name: "LOT Polish Airlines",
    codes: ["LO"],
    aliases: ["lot polish", "polish airlines"],
    url: "https://www.lot.com/pl/en/journey/special-services/traveling-with-pets",
    cabin: { kg: 8, size: "55 × 40 × 20", species: ["dog", "cat", "ferret"] },
    hold: { kind: "yes" },
    noticeHours: 12,
    notes: ["lotEmbraer"],
  },
  {
    id: "ita",
    name: "ITA Airways",
    codes: ["AZ"],
    aliases: ["ita airways", "ita "],
    url: "https://www.ita-airways.com/it/en/book-and-prepare/other-requests/travelling-with-pets/pets-in-cabin.html",
    cabin: { kg: 8, size: "55 × 40 × 23", species: ["dog", "cat"] },
    hold: { kind: "yes", kg: 75 },
    notes: ["itaDomestic", "itaFee"],
  },
  {
    id: "aegean",
    name: "Aegean",
    codes: ["A3", "OA"],
    aliases: ["aegean", "olympic"],
    url: "https://www.aegeanhub.com/en/passenger-services-and-procedures/children-and-pets/pet/",
    cabin: { kg: 8, size: "55 × 40 × 23", species: ["dog", "cat"] },
    hold: { kind: "yes", kg: 50 },
    notes: ["aegeanProp"],
  },
  {
    id: "vueling",
    name: "Vueling",
    codes: ["VY"],
    aliases: ["vueling"],
    url: "https://www.vueling.com/en/vueling-services/prepare-your-trip/pets-on-board",
    cabin: { kg: 10, size: "45 × 39 × 21", species: ["dog", "cat", "bird", "turtle"] },
    hold: { kind: "no" },
    notes: ["vuelingUk"],
  },
  {
    id: "hisky",
    name: "HiSky",
    codes: ["H7", "H4"],
    aliases: ["hisky", "hi sky"],
    url: "https://hisky.aero/en/servicii-aditionale",
    cabin: { kg: 8, species: ["dog", "cat"] },
    hold: { kind: "no" },
    notes: ["hiskyFee"],
    verify: true,
  },
];

/** Match by name ("Wizz Air") or IATA carrier code ("W6", "W6 3101"). */
export function findPetPolicy(text: string): PetPolicy | undefined {
  const value = ` ${text.trim().toLowerCase()} `;
  if (!value.trim()) return undefined;
  const byName = PET_POLICIES.find((p) =>
    p.aliases.some((a) => new RegExp(`\\b${a.trim().replace(/\s+/g, "\\s+")}\\b`).test(value)),
  );
  if (byName) return byName;
  const code = value.trim().match(/^([a-z0-9]{2})(?:\s*\d{1,4})?$/)?.[1]?.toUpperCase();
  return code ? PET_POLICIES.find((p) => p.codes.includes(code)) : undefined;
}

/** Which entry rule applies to a pet flying from → to (ISO country codes). */
export type PetEntry = "gb" | "us" | "tr" | "ae" | "eu" | "intoEu" | "other";

const EU_PET_AREA = new Set(
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE IS LI NO CH".split(
    " ",
  ),
);

export function petEntryRule(from: string, to: string): PetEntry {
  if (to === "GB") return "gb";
  if (to === "US") return "us";
  if (to === "TR") return "tr";
  if (to === "AE") return "ae";
  if (EU_PET_AREA.has(to)) return EU_PET_AREA.has(from) ? "eu" : "intoEu";
  return "other";
}

/** One-line English summary handed to the pre-flight agent. */
export function describePetPolicy(airline: string, to: string): string {
  const p = findPetPolicy(airline);
  const gb = to === "GB" ? " Pets arriving in Great Britain by plane must travel as cargo (assistance dogs excepted)." : "";
  if (!p) return `Pet policy: airline unknown — airlines differ (Wizz Air, Ryanair, easyJet carry no pets).${gb}`;
  const cabin = p.cabin
    ? `cabin allowed up to ${p.cabin.kg} kg including carrier${p.cabin.size ? `, carrier ${p.cabin.size} cm` : ""} (${p.cabin.species.join("/")})`
    : "no pets in the cabin";
  const hold =
    p.hold.kind === "yes"
      ? `hold allowed${p.hold.kg ? ` up to ${p.hold.kg} kg` : ""}`
      : p.hold.kind === "cargo"
        ? "hold only via cargo partner"
        : "no pets in the hold";
  return `Pet policy of ${p.name} (official ${p.url}): ${cabin}; ${hold}; recognised assistance dogs handled separately.${gb}`;
}
