import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Copy, Linkedin, Mail, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDeveloperContact } from "../../lib/developerContact";
import { BackToTopButton } from "../../components/navigation/BackToTopButton";
import { ShellFooter } from "../../components/navigation/ShellFooter";
import { buildAuthShellFooterLinks } from "../../components/navigation/shellFooterLinks";
import { handleExternalLinkClick } from "../../lib/externalLinks";

type CopyField = "developer" | "email" | "phone" | null;

export function AboutPage() {
  const { t } = useTranslation("app");
  const contact = getDeveloperContact();
  const [copiedField, setCopiedField] = useState<CopyField>(null);
  const footerLinks = buildAuthShellFooterLinks((key) => t(key));

  async function copyValue(field: Exclude<CopyField, null>, value: string) {
    if (!value) {
      return;
    }

    await navigator.clipboard.writeText(value);
    setCopiedField(field);
    window.setTimeout(() => setCopiedField((current) => (current === field ? null : current)), 1500);
  }

  return (
    <div className="min-h-screen bg-sand">
      <main className="shell-container py-10">
        <section className="mx-auto max-w-3xl space-y-6">
          <p className="font-heading text-sm uppercase tracking-[0.3em] text-accent">{t("about.eyebrow")}</p>
          <h1 className="font-heading text-4xl text-ink">{t("about.title")}</h1>
          <p className="text-base text-slate-600">{t("about.description")}</p>
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-card">
            <h2 className="font-heading text-2xl text-ink">{t("about.developerTitle")}</h2>
            <p className="mt-1 text-sm text-slate-500">{t("contact.builtWithCare")}</p>
            <div className="mt-5 space-y-3 text-sm">
              <p>
                <span className="font-semibold text-slate-700">{t("contact.developer")}:</span>{" "}
                <button
                  type="button"
                  className="text-slate-600 underline-offset-2 transition hover:text-accent hover:underline"
                  onClick={() => void copyValue("developer", contact.name || "ELMS")}
                >
                  {contact.name || "ELMS"}
                </button>
                <span className="ms-2 text-xs text-slate-500">
                  {copiedField === "developer" ? t("about.copied") : t("about.copy")}
                </span>
              </p>
              {contact.email ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-700">{t("contact.email")}:</span>
                  <a
                    className="text-accent underline-offset-2 hover:underline"
                    href={`mailto:${contact.email}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => handleExternalLinkClick(event, `mailto:${contact.email}`, contact.email)}
                  >
                    {contact.email}
                  </a>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:border-accent hover:text-accent"
                    onClick={() => void copyValue("email", contact.email)}
                  >
                    <Copy size={12} className="me-1" />
                    {copiedField === "email" ? t("about.copied") : t("about.copy")}
                  </button>
                </div>
              ) : null}
              {contact.phone ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-slate-700">{t("contact.phone")}:</span>
                  <a
                    className="text-accent underline-offset-2 hover:underline"
                    href={`tel:${contact.phone}`}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => handleExternalLinkClick(event, `tel:${contact.phone}`, contact.phone)}
                  >
                    {contact.phone}
                  </a>
                  <button
                    type="button"
                    className="inline-flex items-center rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600 transition hover:border-accent hover:text-accent"
                    onClick={() => void copyValue("phone", contact.phone)}
                  >
                    <Copy size={12} className="me-1" />
                    {copiedField === "phone" ? t("about.copied") : t("about.copy")}
                  </button>
                </div>
              ) : null}
              {contact.linkedin ? (
                <p>
                  <span className="font-semibold text-slate-700">{t("contact.linkedin")}:</span>{" "}
                  <a
                    className="text-accent underline-offset-2 hover:underline"
                    href={contact.linkedin}
                    target="_blank"
                    rel="noreferrer"
                    onClick={(event) => handleExternalLinkClick(event, contact.linkedin, contact.linkedin)}
                  >
                    {contact.linkedin}
                  </a>
                </p>
              ) : null}
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {contact.email ? (
                <a
                  href={`mailto:${contact.email}?subject=${encodeURIComponent("ELMS Consultation Request")}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) =>
                    handleExternalLinkClick(
                      event,
                      `mailto:${contact.email}?subject=${encodeURIComponent("ELMS Consultation Request")}`,
                      contact.email
                    )
                  }
                  className="inline-flex items-center rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent-hover"
                >
                  <Mail size={14} className="me-2" />
                  {t("about.bookCall")}
                </a>
              ) : null}
              {contact.phone ? (
                <a
                  href={`tel:${contact.phone}`}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => handleExternalLinkClick(event, `tel:${contact.phone}`, contact.phone)}
                  className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent"
                >
                  <Phone size={14} className="me-2" />
                  {t("contact.phone")}
                </a>
              ) : null}
              {contact.linkedin ? (
                <a
                  href={contact.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  onClick={(event) => handleExternalLinkClick(event, contact.linkedin, contact.linkedin)}
                  className="inline-flex items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-accent hover:text-accent"
                >
                  <Linkedin size={14} className="me-2" />
                  {t("contact.linkedin")}
                </a>
              ) : null}
            </div>
          </div>
          <Link to="/login" className="inline-flex rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:border-accent hover:text-accent">
            {t("footer.login")}
          </Link>
        </section>
      </main>
      <ShellFooter ariaLabel={t("footer.navigation")} links={footerLinks} />
      <BackToTopButton label={t("actions.backToTop")} />
    </div>
  );
}
