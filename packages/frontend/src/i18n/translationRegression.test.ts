import { describe, expect, it } from "vitest";
import appAr from "./locales/ar/app.json";
import appEn from "./locales/en/app.json";
import appFr from "./locales/fr/app.json";
import authAr from "./locales/ar/auth.json";
import authEn from "./locales/en/auth.json";
import authFr from "./locales/fr/auth.json";

type LocaleName = "ar" | "en" | "fr";
type Namespace = "app" | "auth";

const locales: Record<LocaleName, Record<Namespace, Record<string, unknown>>> = {
  ar: { app: appAr as Record<string, unknown>, auth: authAr as Record<string, unknown> },
  en: { app: appEn as Record<string, unknown>, auth: authEn as Record<string, unknown> },
  fr: { app: appFr as Record<string, unknown>, auth: authFr as Record<string, unknown> }
};

function resolve(obj: Record<string, unknown>, key: string): unknown {
  return key.split(".").reduce<unknown>((acc, part) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[part];
  }, obj);
}

const criticalKeys: Array<{ ns: Namespace; key: string }> = [
  { ns: "auth", key: "email" },
  { ns: "auth", key: "password" },
  { ns: "auth", key: "login" },
  { ns: "auth", key: "newPassword" },
  { ns: "auth", key: "confirmPassword" },
  { ns: "auth", key: "passwordMismatch" },
  { ns: "app", key: "calendar.eventTypes.hearing" },
  { ns: "app", key: "calendar.eventTypes.task" },
  { ns: "app", key: "calendar.eventTypes.invoice" },
  { ns: "app", key: "notifications.read" },
  { ns: "app", key: "notifications.unread" },
  { ns: "app", key: "reports.builderTitle" },
  { ns: "app", key: "reports.newReport" },
  { ns: "app", key: "reports.savedReports" },
  { ns: "app", key: "reports.searchPlaceholder" },
  { ns: "app", key: "import.title" },
  { ns: "app", key: "import.previewTitle" },
  { ns: "app", key: "import.resultsTitle" },
  { ns: "app", key: "library.uploadTitle" },
  { ns: "app", key: "library.uploadDescription" },
  { ns: "app", key: "library.uploadSuccess" },
  { ns: "app", key: "documents.loadingPdf" },
  { ns: "app", key: "documents.chooseFile" },
  { ns: "app", key: "documents.noFileSelected" }
];

describe("i18n critical translation coverage", () => {
  for (const lang of ["ar", "en", "fr"] as const) {
    it(`has critical translated keys for ${lang}`, () => {
      for (const item of criticalKeys) {
        const value = resolve(locales[lang][item.ns], item.key);
        expect(typeof value).toBe("string");
        expect(String(value).trim().length).toBeGreaterThan(0);
      }
    });
  }
});
