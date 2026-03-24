import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle } from "lucide-react";
import { usePortalAuthStore } from "../../store/portalAuthStore";

export function PortalLoginPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const login = usePortalAuthStore((s) => s.login);
  const [form, setForm] = useState({ email: "", firmId: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(form.email, form.firmId, form.password);
      void navigate({ to: "/portal/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800">ELMS</h1>
          <p className="mt-1 text-sm text-slate-500">{t("portal.clientPortal")}</p>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        )}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700">{t("auth.email")}</span>
            <input
              autoComplete="email"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
              required
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700">{t("portal.firmId")}</span>
            <input
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              required
              type="text"
              value={form.firmId}
              onChange={(e) => setForm({ ...form, firmId: e.target.value })}
            />
            <p className="text-xs text-slate-400">{t("portal.firmIdHint")}</p>
          </label>
          <label className="block space-y-1">
            <span className="text-sm font-semibold text-slate-700">{t("auth.password")}</span>
            <input
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
              required
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </label>
          <button
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accentHover disabled:opacity-50"
            disabled={loading}
            type="submit"
          >
            {loading && <Loader2 className="size-4 animate-spin" />}
            {t("auth.login")}
          </button>
        </form>
      </div>
    </div>
  );
}
