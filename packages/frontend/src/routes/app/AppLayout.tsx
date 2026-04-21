import { Link, Outlet, useMatches } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Menu, X, LogOut, ChevronRight, ChevronLeft } from "lucide-react";
import { LanguageSwitcher } from "../../components/shared/LanguageSwitcher";
import { GlobalSearchBar } from "../../components/search/GlobalSearchBar";
import { CommandPalette } from "../../components/search/CommandPalette";
import { NotificationBell } from "../../components/notifications/NotificationBell";
import { useAccessibleOverlay } from "../../components/shared/useAccessibleOverlay";
import { useAuthBootstrap } from "../../store/authStore";
import { buildAppBreadcrumbItems } from "./breadcrumbs";
import { SidebarNav } from "./SidebarNav";
import { buildSidebarNavSections } from "./navConfig";
import { BackToTopButton } from "../../components/navigation/BackToTopButton";
import { ShellFooter } from "../../components/navigation/ShellFooter";
import { buildAppShellFooterLinks } from "../../components/navigation/shellFooterLinks";

export function AppLayout() {
  const { t, i18n } = useTranslation("app");
  const { user, logout } = useAuthBootstrap();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);
  const drawerRef = useRef<HTMLElement>(null);
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const headerMenuTriggerRef = useRef<HTMLButtonElement>(null);
  const matches = useMatches();
  const isRtl = i18n.resolvedLanguage === "ar";
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);
  const closeHeaderMenu = useCallback(() => setHeaderMenuOpen(false), []);

  useAccessibleOverlay({
    open: drawerOpen,
    mode: "modal",
    contentRef: drawerRef,
    triggerRef: drawerTriggerRef,
    onClose: closeDrawer
  });
  useAccessibleOverlay({
    open: headerMenuOpen,
    mode: "popover",
    contentRef: headerMenuRef,
    triggerRef: headerMenuTriggerRef,
    onClose: closeHeaderMenu
  });

  useEffect(() => {
    if (!drawerOpen) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [drawerOpen]);

  const navSections = buildSidebarNavSections({
    t,
    permissions: user?.permissions ?? []
  });

  const breadcrumbItems = buildAppBreadcrumbItems({
    paths: matches.map((match) => match.pathname),
    t
  });

  const userInitials = user?.fullName
    ? user.fullName
        .split(" ")
        .slice(0, 2)
        .map((s) => s[0])
        .join("")
        .toUpperCase()
    : "?";

  const SeparatorIcon = isRtl ? ChevronLeft : ChevronRight;
  const footerLinks = buildAppShellFooterLinks(t);

  const navContent = (
    <SidebarNav
      ariaLabel={t("nav.mainNavigation")}
      sections={navSections}
      language={i18n.resolvedLanguage ?? i18n.language ?? "en"}
      emptyLabel={t("nav.noItems")}
      onItemClick={() => setDrawerOpen(false)}
    />
  );

  const userStrip = (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <div className="flex items-center gap-3 rounded-2xl px-3 py-2">
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-bold text-white"
          aria-hidden="true"
        >
          {userInitials}
        </div>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-700">
          {user?.fullName ?? "—"}
        </span>
        <button
          className="rounded-xl p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
          onClick={() => void logout()}
          type="button"
          aria-label={t("actions.logout")}
          title={t("actions.logout")}
        >
          <LogOut size={16} />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-sand text-ink">
      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
      {/* ── Skip to main content (keyboard / screen reader) ── */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-50 focus:rounded-xl focus:bg-accent focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white"
      >
        {t("actions.skipToContent")}
      </a>
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="shell-container flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            {/* Mobile hamburger */}
            <button
              ref={drawerTriggerRef}
              className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100 lg:hidden"
              onClick={() => setDrawerOpen(true)}
              type="button"
              aria-label={t("nav.openMenu")}
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav-drawer"
            >
              <Menu size={22} />
            </button>
            <div>
              <Link
                to="/app/dashboard"
                className="font-heading text-xl font-bold tracking-tight text-accent transition hover:text-accent-hover"
              >
                ELMS
              </Link>
              {breadcrumbItems.length > 0 && (
                <div className="hidden items-center gap-1 text-xs text-slate-400 md:flex">
                  {breadcrumbItems.map((item, i) => (
                    <span
                      key={`${item.label}-${i}`}
                      className="flex items-center gap-1"
                    >
                      {i > 0 && <SeparatorIcon size={12} />}
                      {item.to ? (
                        <Link
                          to={item.to}
                          className="capitalize underline-offset-2 transition hover:text-accent hover:underline"
                        >
                          {item.label}
                        </Link>
                      ) : (
                        <span className="capitalize font-semibold text-slate-600">
                          {item.label}
                        </span>
                      )}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden xl:flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-600">
              <Link
                to="/app/cases/quick-new"
                className="rounded-lg px-2 py-1 hover:bg-white hover:text-accent"
              >
                {t("actions.quickIntake")}
              </Link>
              <span className="text-slate-300" aria-hidden="true">
                |
              </span>
              <Link
                to="/app/tasks/new"
                className="rounded-lg px-2 py-1 hover:bg-white hover:text-accent"
              >
                {t("actions.newTask")}
              </Link>
            </div>
            <div className="hidden lg:block">
              <GlobalSearchBar onOpenPalette={() => setPaletteOpen(true)} />
            </div>
            <NotificationBell />
            <span className="hidden rounded-full bg-accentSoft px-3 py-1 text-xs font-semibold text-emerald-900 xl:inline-flex">
              {t("modes.local")}
            </span>
            <div className="hidden sm:block">
              <LanguageSwitcher />
            </div>
            {/* User avatar */}
            <div
              className="hidden h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-white sm:flex"
              aria-label={user?.fullName ?? userInitials}
              role="img"
            >
              <span aria-hidden="true">{userInitials}</span>
            </div>
            <button
              className="hidden rounded-xl p-2 text-slate-500 transition hover:bg-slate-100 sm:block"
              onClick={() => void logout()}
              type="button"
              aria-label={t("actions.logout")}
              title={t("actions.logout")}
            >
              <LogOut size={18} />
            </button>
            <div className="relative lg:hidden">
              <button
                ref={headerMenuTriggerRef}
                className="rounded-xl p-2 text-slate-500 transition hover:bg-slate-100"
                onClick={() => setHeaderMenuOpen((value) => !value)}
                type="button"
                aria-haspopup="dialog"
                aria-expanded={headerMenuOpen}
                aria-controls="header-actions-menu"
                aria-label={t("actions.more")}
              >
                <Menu size={18} />
              </button>
              {headerMenuOpen && (
                <div
                  id="header-actions-menu"
                  ref={headerMenuRef}
                  className="absolute end-0 top-full z-40 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-3 shadow-elevated"
                  role="dialog"
                  aria-label={t("actions.more")}
                >
                  <div className="space-y-3">
                    <GlobalSearchBar
                      onOpenPalette={() => setPaletteOpen(true)}
                    />
                    <div className="border-t border-slate-100 pt-3">
                      <LanguageSwitcher />
                    </div>
                    <div className="rounded-xl bg-accentSoft px-3 py-2 text-xs font-semibold text-emerald-900">
                      {t("modes.local")}
                    </div>
                    <button
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                      onClick={() => {
                        setHeaderMenuOpen(false);
                        void logout();
                      }}
                      type="button"
                    >
                      <LogOut size={16} />
                      {t("actions.logout")}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile drawer overlay ── */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="mobile-nav-title"
          id="mobile-nav-drawer"
        >
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <aside
            ref={drawerRef}
            tabIndex={-1}
            className="absolute inset-y-0 flex w-72 flex-col border-e border-slate-200 bg-[var(--sidebar-bg)] p-4 shadow-elevated animate-fade-in start-0"
          >
            <div className="mb-4 flex items-center justify-between">
              <p
                id="mobile-nav-title"
                className="font-heading text-lg font-bold text-accent"
              >
                ELMS
              </p>
              <button
                className="rounded-xl border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100"
                onClick={() => setDrawerOpen(false)}
                type="button"
                aria-label={t("nav.closeMenu")}
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{navContent}</div>
            {userStrip}
          </aside>
        </div>
      )}

      {/* ── Main grid ── */}
      <div className="shell-container shell-main-grid py-4 lg:py-5">
        {/* Desktop sidebar */}
        <aside
          className="hidden max-h-[calc(100dvh-var(--header-height)-var(--footer-height)-48px)] rounded-3xl border border-slate-200 bg-[var(--sidebar-bg)] p-3 shadow-card lg:flex lg:flex-col xl:p-4"
          aria-label={t("nav.mainNavigation")}
        >
          <div className="flex-1 overflow-y-auto">{navContent}</div>
          {userStrip}
        </aside>
        <main
          id="main-content"
          className="shell-main-content min-w-0 overflow-auto animate-fade-in rounded-3xl bg-white p-4 shadow-card sm:p-5 lg:p-[var(--density-card-pad)]"
        >
          <Outlet />
        </main>
      </div>
      <ShellFooter ariaLabel={t("footer.navigation")} links={footerLinks} />
      <BackToTopButton
        label={t("actions.backToTop")}
        scrollContainerId="main-content"
      />
    </div>
  );
}
