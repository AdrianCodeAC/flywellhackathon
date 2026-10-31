import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "@/locales/en.json";
import ro from "@/locales/ro.json";

export const LANGUAGES = ["en", "ro"] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_KEY = "arrival-assistant:lang";

// Always start in English so server and first client render match; the stored
// or phone language is applied right after hydration (see syncClientLanguage).
if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources: { en: { translation: en }, ro: { translation: ro } },
    lng: "en",
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    returnNull: false,
  });
}
// Refresh resource bundles when translations change during hot reload.
// Otherwise the long-lived SSR instance can keep the old dictionaries.
i18n.addResourceBundle("en", "translation", en, true, true);
i18n.addResourceBundle("ro", "translation", ro, true, true);

export function pickLanguage(stored: string | null, navigatorLang: string | undefined): Language {
  if (stored === "en" || stored === "ro") return stored;
  return navigatorLang?.toLowerCase().startsWith("ro") ? "ro" : "en";
}

export function setLanguage(lang: Language) {
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
  try {
    localStorage.setItem(LANGUAGE_KEY, lang);
  } catch {
    /* storage unavailable */
  }
}

/** Call from useEffect once on the client. */
export function syncClientLanguage() {
  let stored: string | null = null;
  try {
    stored = localStorage.getItem(LANGUAGE_KEY);
  } catch {
    /* ignore */
  }
  const lang = pickLanguage(stored, navigator.language);
  void i18n.changeLanguage(lang);
  document.documentElement.lang = lang;
}

export default i18n;
