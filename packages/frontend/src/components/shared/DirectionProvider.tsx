import { PropsWithChildren, useEffect } from "react";
import { useTranslation } from "react-i18next";

const rtlLanguages = new Set(["ar"]);

export function DirectionProvider({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();

  useEffect(() => {
    const lang = i18n.resolvedLanguage ?? "ar";
    const dir = rtlLanguages.has(lang) ? "rtl" : "ltr";
    document.documentElement.lang = lang;
    document.documentElement.dir = dir;
    document.documentElement.setAttribute("data-dir", dir);
  }, [i18n.resolvedLanguage]);

  return <>{children}</>;
}
