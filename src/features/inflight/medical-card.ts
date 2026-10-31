/** The passenger's own medical card. Stored only in this phone's localStorage. */
export interface MedicalCard {
  name: string;
  seat: string;
  conditions: string;
  allergies: string;
  medication: string;
  bloodType: string;
  contactName: string;
  contactPhone: string;
}

export const EMPTY_CARD: MedicalCard = {
  name: "",
  seat: "",
  conditions: "",
  allergies: "",
  medication: "",
  bloodType: "",
  contactName: "",
  contactPhone: "",
};

const KEY = "flywell:medical-card";

/** Keeps only known text fields, trimmed to a safe length. */
export function cleanCard(raw: unknown): MedicalCard {
  const source = raw && typeof raw === "object" ? (raw as Partial<Record<keyof MedicalCard, unknown>>) : {};
  const card = { ...EMPTY_CARD };
  for (const k of Object.keys(EMPTY_CARD) as (keyof MedicalCard)[]) {
    const v = source[k];
    if (typeof v === "string") card[k] = v.slice(0, 300);
  }
  return card;
}

/** The phone's copy of the card (the account is the source; the seat is only ever local). */
export function loadCard(): MedicalCard {
  try {
    return cleanCard(JSON.parse(localStorage.getItem(KEY) ?? "{}"));
  } catch {
    return { ...EMPTY_CARD };
  }
}

export function saveCard(card: MedicalCard) {
  try {
    localStorage.setItem(KEY, JSON.stringify(card));
  } catch {
    /* storage unavailable */
  }
}

/** On sign-out the health details leave this phone; the seat number for the current flight stays. */
export function clearCard() {
  saveCard({ ...EMPTY_CARD, seat: loadCard().seat });
}

/** What the account stores: everything except the seat, which changes every flight. */
export const accountCard = (card: MedicalCard) => ({ ...cleanCard(card), seat: "" });

/** The account copy wins for every medical field; the phone keeps its own seat number. */
export const mergeAccountCard = (local: MedicalCard, remote: unknown): MedicalCard => ({
  ...cleanCard(remote),
  seat: local.seat,
});

export const hasMedicalInfo = (c: MedicalCard) =>
  Boolean(c.conditions || c.allergies || c.medication || c.bloodType || c.contactName || c.contactPhone);

/** Lets the help screen and the trip page refresh when the account copy arrives. */
export const CARD_EVENT = "flywell:medical-card-updated";

/** Short show-to-crew phrases. Fixed text so they work with no network or AI. */
export const CREW_PHRASES: { lang: string; label: string; text: string }[] = [
  { lang: "en", label: "English", text: "I need medical help. Please come to my seat." },
  { lang: "ro", label: "Română", text: "Am nevoie de ajutor medical. Vă rog să veniți la locul meu." },
  { lang: "fr", label: "Français", text: "J’ai besoin d’aide médicale. Venez à ma place, s’il vous plaît." },
  { lang: "de", label: "Deutsch", text: "Ich brauche medizinische Hilfe. Bitte kommen Sie zu meinem Platz." },
  { lang: "es", label: "Español", text: "Necesito ayuda médica. Por favor, venga a mi asiento." },
  { lang: "it", label: "Italiano", text: "Ho bisogno di aiuto medico. Per favore, venga al mio posto." },
];

/** Calming breath: in 4 s, hold 4 s, out 6 s (a longer out-breath slows the heart rate). */
export const BREATH = [
  { phase: "inhale", seconds: 4 },
  { phase: "hold", seconds: 4 },
  { phase: "exhale", seconds: 6 },
] as const;
