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

export function loadCard(): MedicalCard {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<MedicalCard>;
    const card = { ...EMPTY_CARD };
    for (const k of Object.keys(EMPTY_CARD) as (keyof MedicalCard)[])
      if (typeof raw[k] === "string") card[k] = raw[k].slice(0, 300);
    return card;
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

export const hasMedicalInfo = (c: MedicalCard) =>
  Boolean(c.conditions || c.allergies || c.medication || c.bloodType || c.contactName || c.contactPhone);

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
