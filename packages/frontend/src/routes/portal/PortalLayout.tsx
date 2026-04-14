import { Link, Outlet, useMatches, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronRight, LogOut } from "lucide-react";
import { usePortalAuthStore } from "../../store/portalAuthStore";
import { LanguageSwitcher } from "../../components/shared/LanguageSwitcher";
import { BackToTopButton } from "../../components/navigation/BackToTopButton";
import { ShellFooter } from "../../components/navigation/ShellFooter";
import { buildPortalShellFooterLinks } from "../../components/navigation/shellFooterLinks";

export function PortalLayout() {
  const { t } = useTranslation("app");
  const { user, logout } = usePortalAuthStore();
  const navigate = useNavigate();
  const matches = useMatches();
  const footerLinks = buildPortalShellFooterLinks(t);
  const inCasePage = matches.some((match) => /^\/portal\/cases\/[^/]+$/.test(match.pathname));
  const breadcrumbItems = [
    { label: t("nav.home"), to: "/portal/dashboard" },
    ...(inCasePage ? [{ label: t("portal.caseDetails") }] : [])
  ];

  return (
    <div className="min-h-screen bg-sand text-ink">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <Link to="/portal/dashboard" className="font-heading text-xl font-bold tracking-tight text-accent transition hover:text-accent-hover">ELMS</Link>
            <span className="hidden rounded-full bg-accentSoft px-3 py-1 text-xs font-semibold text-emerald-900 sm:inline-flex">
              {t("portal.clientPortal")}
            </span>
            <div className="hidden items-center gap-1 text-xs text-slate-400 md:flex">
              {breadcrumbItems.map((item, index) => (
                <span key={`${item.label}-${index}`} className="flex items-center gap-1">
                  {index > 0 && <ChevronRight size={12} />}
                  {item.to ? (
                    <Link to={item.to} className="transition hover:text-accent hover:underline underline-offset-2">{item.label}</Link>
                  ) : (
                    <span className="font-semibold text-slate-600">{item.label}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {user && (
              <div className="flex items-center gap-2">
                <span className="hidden text-sm text-slate-600 sm:inline-flex">{user.name}</span>
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-red-50 hover:text-red-600"
                  onClick={() => {
                    void logout();
                    void navigate({ to: "/login" });
                  }}
                  type="button"
                >
                  <LogOut className="size-4" />
                  {t("actions.logout")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 lg:px-6">
        <div className="rounded-3xl bg-white p-5 shadow-card sm:p-6">
          <Outlet />
        </div>
      </main>
      <ShellFooter
        ariaLabel={t("footer.navigation")}
        links={footerLinks}
        onAction={(action) => {
          if (action === "logout") {
            void (async () => {
              await logout();
              void navigate({ to: "/login", replace: true });
            })();
          }
        }}
      />
      <BackToTopButton label={t("actions.backToTop")} />
    </div>
  );
}
