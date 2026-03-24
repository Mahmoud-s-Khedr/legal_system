import { Outlet } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { LogOut } from "lucide-react";
import { usePortalAuthStore } from "../../store/portalAuthStore";

export function PortalLayout() {
  const { t } = useTranslation("app");
  const { user, logout } = usePortalAuthStore();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-lg font-bold text-accent">ELMS</span>
            <span className="text-sm text-slate-400">{t("portal.clientPortal")}</span>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <span className="text-sm text-slate-600">{user.name}</span>
              <button
                className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-sm text-slate-500 hover:text-red-600"
                onClick={logout}
              >
                <LogOut className="size-4" />
                {t("actions.logout")}
              </button>
            </div>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
