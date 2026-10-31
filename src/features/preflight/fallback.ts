/**
 * Offline answers for the pre-flight chat: when the AI gateway is unavailable
 * (or not configured, as in local development), the question is matched to the
 * checklist rules by keyword so the passenger still gets an official answer.
 */
import { buildChecklist, type ChecklistItem, type PreflightInput } from "./rules";

/** Keywords without diacritics, EN + RO. Order matters only for ties. */
const KEYWORDS: Record<string, string[]> = {
  liquids: [
    "lichid",
    "parfum",
    "apa",
    "ml",
    "100ml",
    "150ml",
    "gel",
    "crema",
    "sampon",
    "liquid",
    "perfume",
    "water",
    "cream",
    "shampoo",
  ],
  powerBank: [
    "powerbank",
    "power bank",
    "baterie",
    "baterii",
    "battery",
    "batteries",
    "incarcator",
    "charger",
    "laptop",
    "tigara electronica",
    "vape",
  ],
  sharp: [
    "cutit",
    "foarfec",
    "briceag",
    "unealta",
    "unelte",
    "knife",
    "scissor",
    "tool",
    "ascutit",
    "sharp",
  ],
  medication: [
    "medicament",
    "pastil",
    "insulin",
    "reteta",
    "medicine",
    "medication",
    "pill",
    "prescription",
  ],
  babyFood: ["bebe", "baby", "lapte praf", "formula"],
  idCardOk: [
    "buletin",
    "carte de identitate",
    "id card",
    "pasaport",
    "passport",
    "viza",
    "visa",
    "act",
  ],
  idCardExtra: ["buletin", "carte de identitate", "id card", "pasaport", "passport"],
  passportNeeded: [
    "buletin",
    "carte de identitate",
    "id card",
    "pasaport",
    "passport",
    "viza",
    "visa",
    "act",
  ],
  visaCheck: ["viza", "visa", "pasaport", "passport", "act"],
  ukEta: ["eta", "anglia", "marea britanie", "uk", "london", "londra"],
  usEsta: ["esta", "sua", "america", "usa", "statele unite"],
  ees: ["ees", "etias", "amprent", "fingerprint"],
  validity: ["expir", "valabil", "valid"],
  childrenRo: ["copil", "copii", "minor", "child", "kid", "acord notarial"],
  children: ["copil", "copii", "minor", "child", "kid"],
  pet: ["caine", "pisica", "animal", "dog", "cat", "pet"],
  cabinOnly: [
    "bagaj de mana",
    "troler",
    "rucsac",
    "cabin bag",
    "carry-on",
    "hand luggage",
    "dimensiun",
    "size",
  ],
  checkedBag: ["bagaj de cala", "cala", "valiza", "checked bag", "suitcase", "checked"],
  valuables: ["bagaj de cala", "cala", "checked bag", "checked", "valoare", "valuable"],
  weigh: ["kg", "greutate", "cantar", "weight", "overweight", "supragreutate"],
  renewEarly: ["pasaport temporar", "temporary passport", "reinnoi", "renew", "eliberare"],
  onlineCheckin: ["check-in", "checkin", "check in", "imbarcare online"],
  arriveEarly: [
    "cat de devreme",
    "cu cat timp",
    "ore inainte",
    "devreme",
    "how early",
    "arrive",
    "ajung la aeroport",
    "ce ora",
  ],
  boardingPass: ["boarding", "carte de imbarcare", "card de imbarcare"],
  cash: ["bani", "cash", "numerar", "euro", "money"],
  meatDairy: [
    "carne",
    "branza",
    "lactate",
    "salam",
    "sandvis",
    "meat",
    "cheese",
    "dairy",
    "food",
    "mancare",
  ],
  allowances: ["tigari", "alcool", "vin", "cigarette", "alcohol", "wine", "duty", "taxe vamale"],
  eu261: [
    "intarzi",
    "anulat",
    "anulare",
    "delay",
    "cancel",
    "compensat",
    "despagub",
    "drepturi",
    "rights",
    "refuz",
  ],
  eu261Inbound: [
    "intarzi",
    "anulat",
    "anulare",
    "delay",
    "cancel",
    "compensat",
    "despagub",
    "drepturi",
    "rights",
  ],
};

const normalize = (s: string) =>
  ` ${s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9-]+/g, " ")} `;

/** Rules a passenger can be told about without knowing the destination. */
function genericItems(): ChecklistItem[] {
  const base: PreflightInput = {
    origin: { iata: "LTN", city: "", countryCode: "GB" },
    destination: { iata: "OTP", city: "", countryCode: "RO" },
    date: "2100-01-01",
    citizenship: "ro",
    bag: "checked",
    airline: "",
    children: true,
    medication: true,
    pet: true,
    lang: "en",
  };
  const seen = new Map<string, ChecklistItem>();
  for (const trip of [
    base,
    { ...base, bag: "cabin" as const },
    { ...base, origin: base.destination, destination: base.origin },
  ])
    for (const item of buildChecklist(trip))
      if (item.category !== "documents" && !seen.has(item.key)) seen.set(item.key, item);
  return [...seen.values()];
}

/**
 * Up to 3 checklist items that answer the question, best match first. With no
 * trip, destination-dependent document rules are left out.
 */
export function matchRules(question: string, input: PreflightInput | null): ChecklistItem[] {
  const text = normalize(question);
  const items = input ? buildChecklist(input) : genericItems();
  return items
    .map((item) => ({
      item,
      score: (KEYWORDS[item.key] ?? []).filter((k) => text.includes(` ${normalize(k).trim()}`))
        .length,
    }))
    .filter((m) => m.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((m) => m.item);
}
