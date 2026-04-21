import { Language } from "@elms/shared";
import { useTranslation } from "react-i18next";

const languages = [
  { value: Language.AR, label: "العربية" },
  { value: Language.EN, label: "English" },
  { value: Language.FR, label: "Français" }
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation("app");
  const activeLanguage = (i18n.resolvedLanguage ?? i18n.language)
    .split("-")[0]
    ?.toUpperCase();

  return (
    <div className="flex gap-2" role="group" aria-label={t("labels.language")}>
      {languages.map((language) => (
        <button
          key={language.value}
          aria-pressed={activeLanguage === language.value}
          className={`rounded-full px-3 py-1 text-sm transition ${
            activeLanguage === language.value
              ? "bg-accent font-semibold text-white"
              : "border border-slate-200 bg-white text-ink hover:bg-slate-100"
          }`}
          onClick={() => void i18n.changeLanguage(language.value.toLowerCase())}
          type="button"
        >
          {language.label}
        </button>
      ))}
    </div>
  );
}
