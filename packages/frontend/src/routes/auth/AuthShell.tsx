import { PropsWithChildren } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "../../components/shared/LanguageSwitcher";
import { ShellFooter } from "../../components/navigation/ShellFooter";
import { buildAuthShellFooterLinks } from "../../components/navigation/shellFooterLinks";
import { BackToTopButton } from "../../components/navigation/BackToTopButton";
import { getDeveloperContact } from "../../lib/developerContact";
import {
  copyTextToClipboard,
  handleExternalLinkClick
} from "../../lib/externalLinks";

export function AuthShell({
  title,
  subtitle,
  children
}: PropsWithChildren<{ title: string; subtitle: string }>) {
  const { t } = useTranslation(["auth", "app"]);
  const contact = getDeveloperContact();
  const developerName = contact.name || "ELMS";
  const footerLinks = buildAuthShellFooterLinks((key) => t(`app:${key}`));

  return (
    <div className="min-h-screen bg-sand">
      <div className="grid min-h-[calc(100vh-124px)] lg:grid-cols-[1.15fr_0.85fr]">
        <section className="flex flex-col justify-between bg-gradient-to-br from-accent to-emerald-800 p-8 text-white">
          <div className="flex items-center justify-between gap-3">
            <Link
              to="/"
              className="font-heading text-xl font-bold tracking-tight text-white transition hover:text-emerald-100"
            >
              ELMS
            </Link>
            <LanguageSwitcher />
          </div>
          <div className="max-w-xl space-y-4">
            <p className="font-heading text-sm uppercase tracking-[0.35em] rtl:tracking-normal text-emerald-100">
              {t("auth:brandEyebrow")}
            </p>
            <h1 className="font-heading text-4xl leading-tight">{title}</h1>
            <p className="max-w-lg text-lg text-emerald-50">{subtitle}</p>
          </div>
          <p className="text-sm text-emerald-100">{t("auth:authFootnote")}</p>
          <div className="rounded-xl border border-emerald-300/30 bg-emerald-900/20 px-4 py-3 text-sm text-emerald-50">
            <p className="font-semibold">
              {t("app:contact.builtBy")}{" "}
              <button
                type="button"
                className="underline-offset-2 transition hover:underline"
                onClick={() => void copyTextToClipboard(developerName)}
                title={t("app:about.copy")}
              >
                {developerName}
              </button>
            </p>
            <p className="text-xs text-emerald-100">
              {t("app:contact.builtWithCare")}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-xs">
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) =>
                    handleExternalLinkClick(
                      event,
                      `mailto:${contact.email}`,
                      contact.email
                    )
                  }
                  className="underline-offset-2 hover:underline"
                >
                  {t("app:contact.email")}
                </a>
              ) : null}
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) =>
                    handleExternalLinkClick(
                      event,
                      `tel:${contact.phone}`,
                      contact.phone
                    )
                  }
                  className="underline-offset-2 hover:underline"
                >
                  {t("app:contact.phone")}
                </a>
              ) : null}
              {contact.linkedin ? (
                <a
                  href={contact.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) =>
                    handleExternalLinkClick(
                      event,
                      contact.linkedin,
                      contact.linkedin
                    )
                  }
                  className="underline-offset-2 hover:underline"
                >
                  {t("app:contact.linkedin")}
                </a>
              ) : null}
            </div>
          </div>
        </section>
        <section className="flex items-center justify-center p-4 sm:p-6 lg:p-10">
          {children}
        </section>
      </div>
      <ShellFooter ariaLabel={t("app:footer.navigation")} links={footerLinks} />
      <BackToTopButton label={t("app:actions.backToTop")} />
    </div>
  );
}
