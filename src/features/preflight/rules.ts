/**
 * Deterministic pre-flight checklist. These rules come from official EU / Romanian
 * sources and never depend on the AI, so the checklist still works when the AI
 * gateway is down. Text lives in the locale files under preflight.rule.*.
 */
import { z } from "zod";
import { describePetPolicy, findPetPolicy, petEntryRule } from "./pets";

/** Official pages the checklist and the agent may cite. URLs were checked by hand. */
export const SOURCES = {
  mae: { name: "MAE — Travel alerts", url: "https://www.mae.ro/travel-alerts" },
  border: { name: "Poliția de Frontieră", url: "https://www.politiadefrontiera.ro/" },
  euEntry: {
    name: "Your Europe — Documents",
    url: "https://europa.eu/youreurope/citizens/travel/entry-exit/index_en.htm",
  },
  euLiquids: {
    name: "Your Europe — Liquids and food",
    url: "https://europa.eu/youreurope/citizens/travel/carry/liquids-and-food/index_en.htm",
  },
  euCarry: {
    name: "Your Europe — What you can carry",
    url: "https://europa.eu/youreurope/citizens/travel/carry/index_en.htm",
  },
  euSecurity: {
    name: "European Commission — Aviation security",
    url: "https://transport.ec.europa.eu/transport-modes/air/aviation-security_en",
  },
  euRights: {
    name: "Your Europe — Air passenger rights",
    url: "https://europa.eu/youreurope/citizens/travel/passenger-rights/air/index_en.htm",
  },
  easa: { name: "EASA — Passengers", url: "https://www.easa.europa.eu/en/passengers" },
  travelEurope: { name: "Travel to Europe (EES / ETIAS)", url: "https://travel-europe.europa.eu/" },
  ukEta: {
    name: "GOV.UK — Electronic travel authorisation",
    url: "https://www.gov.uk/guidance/apply-for-an-electronic-travel-authorisation-eta",
  },
  usEsta: { name: "ESTA — U.S. CBP", url: "https://esta.cbp.dhs.gov/" },
  euPets: {
    name: "Your Europe — Travelling with pets",
    url: "https://europa.eu/youreurope/citizens/travel/carry/pets-and-other-animals/index_en.htm",
  },
  euPetsEntry: {
    name: "European Commission — Pets from non-EU countries",
    url: "https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/bringing-pet-eu-non-eu-country_en",
  },
  gbPets: {
    name: "GOV.UK — Bringing a pet to Great Britain",
    url: "https://www.gov.uk/bring-pet-to-great-britain/travel-routes-pets",
  },
  usDogs: {
    name: "CDC — Bringing a dog into the U.S.",
    url: "https://www.cdc.gov/importation/dogs/rabies-free-low-risk-countries.html",
  },
  usAnimals: {
    name: "CDC — Bringing an animal into the U.S.",
    url: "https://www.cdc.gov/importation/bringing-an-animal-into-the-us/",
  },
  trPets: {
    name: "Türkiye Ministry of Agriculture — Pet travel",
    url: "https://vskn.tarimorman.gov.tr/ataturk/Link/16/Kedi-Kopek-Gelincik-Seyahati",
  },
  aePets: {
    name: "UAE MOCCAE — Pet import permit",
    url: "https://moccae.gov.ae/en/services/import-permit-pets",
  },
} as const;
export type SourceId = keyof typeof SOURCES;
export const SOURCE_IDS = Object.keys(SOURCES) as [SourceId, ...SourceId[]];

const EU = new Set(
  "AT BE BG HR CY CZ DK EE FI FR DE GR HU IE IT LV LT LU MT NL PL PT RO SK SI ES SE".split(" "),
);
/** EU + EEA + Switzerland: free movement, where a Romanian ID card is enough. */
const FREE_MOVEMENT = new Set([...EU, "IS", "LI", "NO", "CH"]);
/** Schengen area since 1 January 2025 (Romania and Bulgaria full members). */
const SCHENGEN = new Set([
  ...[...EU].filter((c) => c !== "CY" && c !== "IE"),
  "IS",
  "LI",
  "NO",
  "CH",
]);
/** Non-EU countries that accept a Romanian ID card (MAE guidance); confirm before travel. */
const ID_CARD_EXTRA = new Set(["MD", "RS", "ME", "MK", "AL", "BA", "GE", "AD", "MC", "SM", "VA"]);

export const isEu = (country: string) => EU.has(country);
export const isSchengen = (country: string) => SCHENGEN.has(country);

export const CATEGORIES = [
  "documents",
  "security",
  "baggage",
  "timeline",
  "customs",
  "rights",
] as const;
export type Category = (typeof CATEGORIES)[number];
export type Priority = "must" | "should" | "info";

export const preflightInputSchema = z.object({
  origin: z.object({
    iata: z.string().regex(/^[A-Z]{3}$/),
    city: z.string().max(100),
    countryCode: z.string().length(2),
  }),
  destination: z.object({
    iata: z.string().regex(/^[A-Z]{3}$/),
    city: z.string().max(100),
    countryCode: z.string().length(2),
  }),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  citizenship: z.enum(["ro", "eu", "other"]),
  bag: z.enum(["cabin", "checked"]),
  airline: z.string().trim().max(60).default(""),
  seat: z.string().trim().max(4).default(""),
  children: z.boolean(),
  medication: z.boolean(),
  pet: z.boolean(),
  lang: z.enum(["en", "ro"]),
});
export type PreflightInput = z.infer<typeof preflightInputSchema>;

export interface ChecklistItem {
  id: string;
  category: Category;
  priority: Priority;
  /** Locale key under preflight.rule.<key>.{title,detail} */
  key: string;
  params?: Record<string, string | number> | undefined;
  source?: SourceId | undefined;
}

/** Whole days from today (local) until the flight date; negative when it is in the past. */
export function daysUntil(date: string, today = new Date()): number {
  const start = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.round((Date.parse(`${date}T00:00:00Z`) - start) / 86_400_000);
}

/** Recommended hours at the airport before departure. */
export function arrivalHours(
  input: Pick<PreflightInput, "origin" | "destination" | "bag">,
): number {
  const insideSchengen =
    isSchengen(input.origin.countryCode) && isSchengen(input.destination.countryCode);
  const base = insideSchengen ? 2 : 3;
  return input.bag === "checked" && insideSchengen ? base + 0.5 : base;
}

export function buildChecklist(input: PreflightInput, today = new Date()): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const add = (
    category: Category,
    priority: Priority,
    key: string,
    source?: SourceId,
    params?: ChecklistItem["params"],
  ) => items.push({ id: key, category, priority, key, source, params });
  const from = input.origin.countryCode;
  const to = input.destination.countryCode;
  const european = input.citizenship !== "other";
  const city = input.destination.city;

  // Documents
  if (european && FREE_MOVEMENT.has(to)) add("documents", "must", "idCardOk", "euEntry", { city });
  else if (input.citizenship === "ro" && ID_CARD_EXTRA.has(to))
    add("documents", "must", "idCardExtra", "mae", { city });
  else if (european) add("documents", "must", "passportNeeded", "mae", { city });
  else add("documents", "must", "visaCheck", "travelEurope", { city });
  if (to === "GB") add("documents", "must", "ukEta", "ukEta");
  if (to === "US") add("documents", "must", "usEsta", "usEsta");
  if (!european && (isSchengen(to) || isSchengen(from)) && !(isSchengen(to) && isSchengen(from)))
    add("documents", "must", "ees", "travelEurope");
  add("documents", "should", "validity", european ? "euEntry" : "travelEurope");
  if (input.citizenship === "ro" && !FREE_MOVEMENT.has(to))
    add("documents", "info", "maeAlerts", "mae", { city });
  if (input.children)
    add(
      "documents",
      "must",
      input.citizenship === "ro" ? "childrenRo" : "children",
      input.citizenship === "ro" ? "border" : "euEntry",
    );
  if (input.pet) {
    const airline = findPetPolicy(input.airline);
    if (airline && !airline.cabin && airline.hold.kind === "no") {
      // Nothing else matters when the airline won't carry the pet.
      add("documents", "must", "petAirlineNo", undefined, { airline: airline.name });
    } else {
      const entry = petEntryRule(from, to);
      const entrySource = {
        gb: "gbPets",
        us: "usDogs",
        tr: "trPets",
        ae: "aePets",
        eu: "euPets",
        intoEu: "euPetsEntry",
        other: "mae",
      } as const satisfies Record<typeof entry, SourceId>;
      add("documents", "must", `pet_${entry}`, entrySource[entry], { city });
      if (entry === "us") add("documents", "info", "pet_usCats", "usAnimals");
      if (!airline) add("documents", "must", "petAirlineUnknown");
      else if (to === "GB") {
        // pet_gb already says "cargo only"; the airline's cabin rule does not apply.
      } else if (airline.cabin)
        add("documents", "must", "petAirlineCabin", undefined, {
          airline: airline.name,
          kg: airline.cabin.kg,
        });
      else add("documents", "must", "petAirlineCargo", undefined, { airline: airline.name });
    }
  }

  // Security checkpoint (EU rules apply at every EU airport)
  add("security", "must", "liquids", "euLiquids");
  add("security", "must", "powerBank", "easa");
  add("security", "must", "sharp", "euSecurity");
  if (input.medication) add("security", "should", "medication", "euLiquids");
  if (input.children) add("security", "info", "babyFood", "euLiquids");

  // Baggage
  add("baggage", "must", input.bag === "cabin" ? "cabinOnly" : "checkedBag", undefined, {
    airline: input.airline || "—",
  });
  if (input.bag === "checked") add("baggage", "should", "valuables");
  add("baggage", "info", "weigh");

  // Timeline, relative to today
  const days = daysUntil(input.date, today);
  if (!european || !FREE_MOVEMENT.has(to))
    add("timeline", days < 21 ? "must" : "should", "renewEarly", "mae", {
      days: Math.max(days, 0),
    });
  add("timeline", "should", "onlineCheckin");
  add("timeline", "must", "arriveEarly", undefined, { hours: arrivalHours(input) });
  add("timeline", "info", "boardingPass");

  // Customs — the EU border only matters when the flight crosses it
  if (isEu(from) !== isEu(to)) {
    add("customs", "must", "cash", "euCarry");
    if (isEu(to)) {
      add("customs", "must", "meatDairy", "euLiquids");
      add("customs", "info", "allowances", "euCarry");
    }
  }

  // Passenger rights (Regulation EC 261/2004)
  if (isEu(from)) add("rights", "info", "eu261", "euRights");
  else if (isEu(to)) add("rights", "info", "eu261Inbound", "euRights");

  return items;
}

/** Plain-text trip summary handed to the agent. */
export function describeTrip(input: PreflightInput): string {
  const citizenship = {
    ro: "Romanian citizen",
    eu: "EU/EEA citizen (not Romanian)",
    other: "non-EU citizen",
  }[input.citizenship];
  return [
    `Flight: ${input.origin.city} (${input.origin.iata}, ${input.origin.countryCode}) → ${input.destination.city} (${input.destination.iata}, ${input.destination.countryCode})`,
    `Date: ${input.date}`,
    `Passenger: ${citizenship}`,
    `Baggage: ${input.bag === "cabin" ? "cabin bag only" : "checked bag"}`,
    input.airline ? `Airline: ${input.airline}` : "Airline: unknown",
    `Travelling with children: ${input.children ? "yes" : "no"}; carrying medication: ${input.medication ? "yes" : "no"}; travelling with a pet: ${input.pet ? "yes" : "no"}`,
    ...(input.pet ? [describePetPolicy(input.airline, input.destination.countryCode)] : []),
  ].join("\n");
}

/** One checklist per trip, so ticked boxes survive a reload but not a new trip. */
export function checklistStorageKey(
  input: Pick<PreflightInput, "origin" | "destination" | "date">,
) {
  return `flywell:preflight:${input.origin.iata}-${input.destination.iata}-${input.date}`;
}
