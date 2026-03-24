import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import authAr from "./locales/ar/auth.json";
import appAr from "./locales/ar/app.json";
import authEn from "./locales/en/auth.json";
import appEn from "./locales/en/app.json";
import authFr from "./locales/fr/auth.json";
import appFr from "./locales/fr/app.json";

const STORAGE_KEY = "elms-lang";

function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && ["ar", "en", "fr"].includes(stored)) return stored;
  } catch {
    /* localStorage may be unavailable */
  }
  return (import.meta.env.VITE_APP_LOCALE as string | undefined) ?? "ar";
}

void i18n.use(initReactI18next).init({
  lng: getInitialLanguage(),
  fallbackLng: "en",
  interpolation: {
    escapeValue: false
  },
  resources: {
    ar: {
      auth: authAr,
      app: appAr
    },
    en: {
      auth: authEn,
      app: appEn
    },
    fr: {
      auth: authFr,
      app: appFr
    }
  }
});

// Persist language changes to localStorage
i18n.on("languageChanged", (lng) => {
  try {
    localStorage.setItem(STORAGE_KEY, lng);
  } catch {
    /* ignore */
  }
});

export default i18n;

