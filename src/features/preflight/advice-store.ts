import { adviceSchema, type PreflightAdvice } from "./ai.functions";

/**
 * AI checklist items are generated once per trip and language, then kept with the trip
 * (on the phone and in the account copy) so ticks survive and they open in airplane mode.
 */
export type StoredAdvice = Partial<Record<"en" | "ro", PreflightAdvice>>;

const adviceKey = (checklistKey: string) => `${checklistKey}:ai`;

export function parseStoredAdvice(raw: unknown): StoredAdvice {
  const out: StoredAdvice = {};
  if (!raw || typeof raw !== "object") return out;
  for (const lang of ["en", "ro"] as const) {
    const parsed = adviceSchema.safeParse((raw as Record<string, unknown>)[lang]);
    if (parsed.success) out[lang] = parsed.data;
  }
  return out;
}

export function loadAdvice(checklistKey: string): StoredAdvice {
  try {
    return parseStoredAdvice(JSON.parse(localStorage.getItem(adviceKey(checklistKey)) ?? "null"));
  } catch {
    return {};
  }
}

/** Merges into what is stored; an existing language is never replaced, so items stay fixed. */
export function storeAdvice(checklistKey: string, incoming: StoredAdvice): StoredAdvice {
  const next = { ...parseStoredAdvice(incoming), ...loadAdvice(checklistKey) };
  try {
    localStorage.setItem(adviceKey(checklistKey), JSON.stringify(next));
  } catch {
    /* storage unavailable */
  }
  return next;
}
