import { useEffect, type PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { isArabicLanguage } from "../../lib/language";

export function DirectionProvider({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();

  useEffect(() => {
    const lang = i18n.resolvedLanguage ?? i18n.language ?? "ar";
    const dir = isArabicLanguage(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.documentElement.setAttribute("data-dir", dir);
  }, [i18n.language, i18n.resolvedLanguage]);

  return <>{children}</>;
}
