import { Link } from "@tanstack/react-router";
import { Linkedin, Mail, Phone } from "lucide-react";
import { useTranslation } from "react-i18next";
import { getDeveloperContact } from "../../lib/developerContact";
import { handleExternalLinkClick } from "../../lib/externalLinks";

export interface ShellFooterLink {
  id: string;
  label: string;
  to: string;
}

export function ShellFooter({
  ariaLabel,
  links
}: {
  ariaLabel: string;
  links: ShellFooterLink[];
}) {
  const { t } = useTranslation("app");
  const contact = getDeveloperContact();
  const developerName = contact.name || "ELMS";

  return (
    <footer className="border-t border-slate-200 bg-white/90 py-4">
      <div className="shell-container flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500">{ariaLabel}</span>
          <nav className="flex flex-wrap items-center gap-2" aria-label={ariaLabel}>
            {links.map((link) => (
              <Link
                key={link.id}
                to={link.to}
                className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:border-accent hover:text-accent"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-3 text-xs text-slate-500">
          <p className="flex flex-wrap items-center gap-1">
            <span>{t("contact.builtBy")}</span>
            <button
              type="button"
              className="font-semibold text-slate-700 underline-offset-2 transition hover:text-accent hover:underline"
              onClick={() => void navigator.clipboard.writeText(developerName)}
              title={t("about.copy")}
            >
              {developerName}
            </button>
            <span className="text-slate-400">•</span>
            <span>{t("contact.builtWithCare")}</span>
          </p>
          <div className="flex items-center gap-2">
            {contact.email ? (
              <a
                href={`mailto:${contact.email}`}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => handleExternalLinkClick(event, `mailto:${contact.email}`, contact.email)}
                className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-accent hover:text-accent"
                title={t("contact.email")}
                aria-label={t("contact.email")}
              >
                <Mail size={14} />
              </a>
            ) : null}
            {contact.phone ? (
              <a
                href={`tel:${contact.phone}`}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => handleExternalLinkClick(event, `tel:${contact.phone}`, contact.phone)}
                className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-accent hover:text-accent"
                title={t("contact.phone")}
                aria-label={t("contact.phone")}
              >
                <Phone size={14} />
              </a>
            ) : null}
            {contact.linkedin ? (
              <a
                href={contact.linkedin}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => handleExternalLinkClick(event, contact.linkedin, contact.linkedin)}
                className="rounded-md border border-slate-200 p-1.5 text-slate-500 transition hover:border-accent hover:text-accent"
                title={t("contact.linkedin")}
                aria-label={t("contact.linkedin")}
              >
                <Linkedin size={14} />
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
