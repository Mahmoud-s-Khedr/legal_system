import { PropsWithChildren } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/shared/LanguageSwitcher";
import { ShellFooter } from "../../components/navigation/ShellFooter";
import { buildAuthShellFooterLinks } from "../../components/navigation/shellFooterLinks";
import { BackToTopButton } from "../../components/navigation/BackToTopButton";

export function AuthShell({
  title,
  subtitle,
  children
}: PropsWithChildren<{ title: string; subtitle: string }>) {
  const { t } = useTranslation(["auth", "app"]);
  const footerLinks = buildAuthShellFooterLinks((key) => t(`app:${key}`));

  return (
    <div className="min-h-screen bg-sand">
      <div className="grid min-h-[calc(100vh-124px)] lg:grid-cols-[1.1fr_0.9fr]">
        <section className="flex flex-col justify-between bg-gradient-to-br from-accent to-emerald-800 p-8 text-white">
          <div className="flex items-center justify-between gap-3">
            <Link to="/" className="font-heading text-xl font-bold tracking-tight text-white transition hover:text-emerald-100">ELMS</Link>
            <LanguageSwitcher />
          </div>
          <div className="max-w-xl space-y-4">
            <p className="font-heading text-sm uppercase tracking-[0.35em] rtl:tracking-normal text-emerald-100">
              {t("auth:brandEyebrow")}
            </p>
            <h1 className="font-heading text-4xl leading-tight">{title}</h1>
            <p className="max-w-lg text-lg text-emerald-50">{subtitle}</p>
          </div>
          <p className="text-sm text-emerald-100">
            {t("auth:authFootnote")}
          </p>
        </section>
        <section className="flex items-center justify-center p-6 lg:p-10">{children}</section>
      </div>
      <ShellFooter ariaLabel={t("app:footer.navigation")} links={footerLinks} />
      <BackToTopButton label={t("app:actions.backToTop")} />
    </div>
  );
}
