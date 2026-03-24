import { PropsWithChildren } from "react";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/shared/LanguageSwitcher";

export function AuthShell({
  title,
  subtitle,
  children
}: PropsWithChildren<{ title: string; subtitle: string }>) {
  const { t } = useTranslation("auth");

  return (
    <div className="grid min-h-screen bg-sand lg:grid-cols-[1.1fr_0.9fr]">
      <section className="flex flex-col justify-between bg-gradient-to-br from-accent to-emerald-800 p-8 text-white">
        <div className="flex justify-end">
          <LanguageSwitcher />
        </div>
        <div className="max-w-xl space-y-4">
          <p className="font-heading text-sm uppercase tracking-[0.35em] rtl:tracking-normal text-emerald-100">
            {t("brandEyebrow")}
          </p>
          <h1 className="font-heading text-4xl leading-tight">{title}</h1>
          <p className="max-w-lg text-lg text-emerald-50">{subtitle}</p>
        </div>
        <p className="text-sm text-emerald-100">
          {t("authFootnote")}
        </p>
      </section>
      <section className="flex items-center justify-center p-6 lg:p-10">{children}</section>
    </div>
  );
}
