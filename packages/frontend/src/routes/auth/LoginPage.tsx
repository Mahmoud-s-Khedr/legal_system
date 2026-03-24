import { FormEvent, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "./AuthShell";
import { useAuthBootstrap } from "../../store/authStore";

export function LoginPage() {
  const { t } = useTranslation("auth");
  const { login } = useAuthBootstrap();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await login({ email, password });
      await navigate({ to: "/app/dashboard" });
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title={t("loginTitle")} subtitle={t("loginSubtitle")}>
      <form className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-elevated animate-slide-up" onSubmit={handleSubmit}>
        <div>
          <label className="mb-2 block text-sm font-semibold">{t("email")}<span className="text-red-500 ms-1" aria-hidden="true">*</span></label>
          <input
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 transition focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            value={email}
            autoComplete="email"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-semibold">{t("password")}<span className="text-red-500 ms-1" aria-hidden="true">*</span></label>
          <div className="relative">
            <input
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 pe-12 transition focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              value={password}
              autoComplete="current-password"
            />
            <button
              className="absolute top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600 end-3"
              onClick={() => setShowPassword((prev) => !prev)}
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {error ? (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <span className="font-bold">⚠</span>
            <span>{error}</span>
          </div>
        ) : null}
        <button
          className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          type="submit"
          disabled={loading}
        >
          {loading ? "…" : t("login")}
        </button>
        <div className="flex justify-between text-sm text-slate-600">
          <Link className="transition hover:text-accent" to="/register">{t("registerLink")}</Link>
          <Link className="transition hover:text-accent" to="/setup">{t("desktopSetupLink")}</Link>
        </div>
      </form>
    </AuthShell>
  );
}

