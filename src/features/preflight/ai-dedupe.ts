/**
 * Drops AI checklist items that repeat what the fixed checklist already says.
 * Each topic lists the fixed rule keys that cover it and words that identify it
 * in an AI title or detail (diacritics removed, lower case, EN + RO).
 */
interface Topic {
  keys: string[];
  words: RegExp;
}

const TOPICS: Topic[] = [
  {
    keys: ["idCardOk", "idCardExtra", "passportNeeded", "visaCheck", "ukEta", "usEsta", "ees", "validity"],
    words:
      /\b(visa|visas|viza|vize|passport\w*|pasaport\w*|id card|identity card|carte\w* de identitate|buletin\w*|entry document\w*|act\w* de (calatorie|identitate)|eta|esta|etias|ees)\b/,
  },
  { keys: ["liquids"], words: /\b(liquid\w*|lichid\w*|100 ?ml)\b/ },
  { keys: ["powerBank"], words: /\b(power ?bank\w*|baterii|battery|batteries|lithium|litiu)\b/ },
  { keys: ["sharp"], words: /\b(knife|knives|cutit\w*|sharp|ascutit\w*|scissors|foarfec\w*)\b/ },
  {
    keys: ["cabinOnly", "checkedBag"],
    words: /\b(cabin bag|hand luggage|carry-on|bagaj\w* de (mana|cabina|cala)|checked bag\w*|baggage allowance|personal item|obiect personal)\b/,
  },
  { keys: ["onlineCheckin"], words: /\b(online check-?in|check-?in online)\b/ },
  { keys: ["arriveEarly"], words: /\b(arrive (early|at the airport)|ajung\w* (devreme|la aeroport)|hours before departure|ore inainte)\b/ },
  { keys: ["boardingPass"], words: /\b(boarding pass\w*|card\w* de imbarcare|carte\w* de imbarcare)\b/ },
  { keys: ["eu261", "eu261Inbound"], words: /\b(261|compensation|compensati\w*|despagubir\w*|passenger rights|drepturile? pasager\w*)\b/ },
  { keys: ["cash"], words: /\b(cash|numerar|10 ?000)\b/ },
  { keys: ["meatDairy"], words: /\b(meat|dairy|carne|lactate)\b/ },
  { keys: ["medication"], words: /\b(medicin\w*|medicament\w*|medication|prescription|reteta)\b/ },
  { keys: ["babyFood"], words: /\b(baby food|baby milk|hrana pentru bebelus\w*|lapte praf)\b/ },
  { keys: ["children", "childrenRo"], words: /\b(parental consent|acord\w* parental\w*|consimtamant\w*|minor\w*)\b/ },
  { keys: ["renewEarly"], words: /\b(renew\w*|reinnoi\w*)\b/ },
  { keys: ["maeAlerts"], words: /\b(mae|travel alert\w*|alert\w* de calatorie)\b/ },
];

const PET_SOURCES = new Set(["euPets", "euPetsEntry", "gbPets", "usDogs", "usAnimals", "trPets", "aePets"]);
const plain = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Pet rules come only from rules.ts; AI duplicates are dropped. */
export function isPetItem(i: { title: string; detail?: string; source?: string | null }): boolean {
  if (i.source && PET_SOURCES.has(i.source)) return true;
  return /\b(pet|pets|animal\w*|dog|dogs|cat|cats|caine|caini|pisic\w*|dihor\w*|ferret\w*)\b/.test(plain(i.title));
}

/** True when an AI item is about a topic the fixed checklist already covers. */
export function repeatsChecklist(
  item: { title: string; detail?: string; source?: string | null },
  coveredKeys: readonly string[],
): boolean {
  if (isPetItem(item)) return true;
  const title = plain(item.title);
  return TOPICS.some((topic) => topic.keys.some((k) => coveredKeys.includes(k)) && topic.words.test(title));
}
