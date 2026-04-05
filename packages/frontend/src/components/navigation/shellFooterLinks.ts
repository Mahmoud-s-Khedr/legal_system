import type { ShellFooterLink } from "./ShellFooter";

type Translate = (key: string) => string;

export function buildAppShellFooterLinks(t: Translate): ShellFooterLink[] {
  return [
    { id: "dashboard", label: t("nav.dashboard"), to: "/app/dashboard" },
    { id: "cases", label: t("nav.cases"), to: "/app/cases" },
    { id: "search", label: t("actions.search"), to: "/app/search" },
    { id: "documents", label: t("nav.documents"), to: "/app/documents" }
  ];
}

export function buildPortalShellFooterLinks(t: Translate): ShellFooterLink[] {
  return [
    { id: "home", label: t("nav.home"), to: "/portal/dashboard" },
    { id: "dashboard", label: t("portal.dashboard"), to: "/portal/dashboard" },
    { id: "logout", label: t("actions.logout"), to: "/login" }
  ];
}

export function buildAuthShellFooterLinks(t: Translate): ShellFooterLink[] {
  return [
    { id: "login", label: t("footer.login"), to: "/login" },
    { id: "setup", label: t("footer.setup"), to: "/setup" },
    { id: "connection", label: t("footer.connection"), to: "/connection" }
  ];
}
