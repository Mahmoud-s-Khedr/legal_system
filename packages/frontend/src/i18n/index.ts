import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import authAr from "./locales/ar/auth.json";
import appAr from "./locales/ar/app.json";
import authEn from "./locales/en/auth.json";
import appEn from "./locales/en/app.json";
import authFr from "./locales/fr/auth.json";
import appFr from "./locales/fr/app.json";

const STORAGE_KEY = "elms-lang";
const SUPPORTED_LANGUAGES = ["ar", "en", "fr"] as const;
type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];
const listenerRegistryKey = "__elmsI18nListenerCleanup__";

function getInitialLanguage(): string {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && SUPPORTED_LANGUAGES.includes(stored as SupportedLanguage)) return stored;
  } catch {
    /* localStorage may be unavailable */
  }
  return (import.meta.env.VITE_APP_LOCALE as string | undefined) ?? "ar";
}

function normalizeLanguage(value: string | null | undefined): SupportedLanguage | null {
  if (!value) {
    return null;
  }

  const candidate = value.trim().toLowerCase().split("-")[0];
  return SUPPORTED_LANGUAGES.includes(candidate as SupportedLanguage)
    ? (candidate as SupportedLanguage)
    : null;
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

export async function applyUserPreferredLanguage(preferredLanguage: string | null | undefined) {
  const normalized = normalizeLanguage(preferredLanguage);
  if (!normalized || i18n.resolvedLanguage?.toLowerCase() === normalized) {
    return;
  }

  try {
    await i18n.changeLanguage(normalized);
  } catch {
    /* ignore language switch errors */
  }
}

export function registerI18nLanguagePersistence(): () => void {
  const handler = (lng: string) => {
    const normalized = normalizeLanguage(lng);
    if (!normalized) {
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, normalized);
    } catch {
      /* ignore */
    }
  };

  i18n.on("languageChanged", handler);
  return () => i18n.off("languageChanged", handler);
}

const i18nGlobal = globalThis as typeof globalThis & {
  [listenerRegistryKey]?: () => void;
};

if (i18nGlobal[listenerRegistryKey]) {
  i18nGlobal[listenerRegistryKey]?.();
}
i18nGlobal[listenerRegistryKey] = registerI18nLanguagePersistence();

export default i18n;
