import { useState } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";

export function PortalAcceptInvitePage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const search = useSearch({ strict: false }) as { token?: string };
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      setError(t("auth.passwordMismatch"));
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/portal/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: search.token, password })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: "Failed" }));
        throw new Error((err as { message?: string }).message ?? "Failed");
      }
      setDone(true);
      setTimeout(() => void navigate({ to: "/portal/login" }), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="text-center">
          <h1 className="text-xl font-bold text-slate-800">{t("portal.acceptInvite")}</h1>
          <p className="mt-1 text-sm text-slate-500">{t("portal.setPasswordHint")}</p>
        </div>

        {done ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <CheckCircle2 className="size-10 text-green-500" />
            <p className="text-sm font-semibold text-green-700">{t("portal.passwordSet")}</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="flex items-center gap-2 rounded-2xl bg-red-50 px-4 py-3 text-sm text-red-700">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}
            <form className="space-y-4" onSubmit={handleSubmit}>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">{t("auth.newPassword")}</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
                  minLength={8}
                  required
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">{t("auth.confirmPassword")}</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-accent"
                  minLength={8}
                  required
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                />
              </label>
              <button
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-accent py-2.5 text-sm font-semibold text-white hover:bg-accentHover disabled:opacity-50"
                disabled={loading || !search.token}
                type="submit"
              >
                {loading && <Loader2 className="size-4 animate-spin" />}
                {t("portal.setPassword")}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
