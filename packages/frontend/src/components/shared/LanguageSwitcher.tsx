import { Language } from "@elms/shared";
import { useTranslation } from "react-i18next";

const languages = [
  { value: Language.AR, label: "العربية" },
  { value: Language.EN, label: "English" },
  { value: Language.FR, label: "Français" }
];

export function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <div className="flex gap-2">
      {languages.map((language) => (
        <button
          key={language.value}
          className={`rounded-full px-3 py-1 text-sm transition ${
            i18n.language.toUpperCase() === language.value
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
