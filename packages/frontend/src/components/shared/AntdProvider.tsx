import { type PropsWithChildren } from "react";
import { ConfigProvider, theme as antdTheme } from "antd";
import arEG from "antd/locale/ar_EG";
import enUS from "antd/locale/en_US";
import frFR from "antd/locale/fr_FR";
import { useTranslation } from "react-i18next";

function resolveAntdLocale(language: string) {
  if (language === "ar") return arEG;
  if (language === "fr") return frFR;
  return enUS;
}

export function AntdProvider({ children }: PropsWithChildren) {
  const { i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? "ar";
  const direction = language === "ar" ? "rtl" : "ltr";

  return (
    <ConfigProvider
      direction={direction}
      locale={resolveAntdLocale(language)}
      theme={{
        algorithm: antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: "#0f766e",
          colorInfo: "#0f766e",
          colorText: "#1f2937",
          colorBgContainer: "#ffffff",
          borderRadius: 12,
          borderRadiusLG: 16,
          fontFamily: '"Cairo", system-ui, sans-serif',
          controlHeight: 48
        },
        components: {
          Select: {
            optionSelectedBg: "#d1fae5",
            activeBorderColor: "#0f766e",
            hoverBorderColor: "#0f766e",
            activeOutlineColor: "rgba(15,118,110,0.24)"
          }
        }
      }}
    >
      {children}
    </ConfigProvider>
  );
}
