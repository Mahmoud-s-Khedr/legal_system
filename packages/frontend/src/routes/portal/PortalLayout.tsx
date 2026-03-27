import { Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { usePortalAuthStore } from "../../store/portalAuthStore";
import { LanguageSwitcher } from "../../components/shared/LanguageSwitcher";

export function PortalLayout() {
  const { t } = useTranslation("app");
  const { user, logout } = usePortalAuthStore();

  return (
    <div className="min-h-screen bg-sand text-ink">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <span className="font-heading text-xl font-bold tracking-tight text-accent">ELMS</span>
            <span className="hidden rounded-full bg-accentSoft px-3 py-1 text-xs font-semibold text-emerald-900 sm:inline-flex">
              {t("portal.clientPortal")}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            {user && (
              <div className="flex items-center gap-2">
                <span className="hidden text-sm text-slate-600 sm:inline-flex">{user.name}</span>
                <button
                  className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-600 transition hover:bg-red-50 hover:text-red-600"
                  onClick={logout}
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
    </div>
  );
}
