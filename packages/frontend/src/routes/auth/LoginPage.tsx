import { FormEvent, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { AuthShell } from "./AuthShell";
import { useAuthBootstrap } from "../../store/authStore";
import { Field, FormAlert } from "../app/ui";

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
        <Field
          id="login-email"
          label={t("email")}
          onChange={setEmail}
          required
          type="email"
          value={email}
        />
        <div>
          <label className="mb-2 block text-sm font-semibold" htmlFor="login-password">
            {t("password")}
            <span className="text-red-500 ms-1" aria-hidden="true">*</span>
          </label>
          <div className="relative">
            <input
              id="login-password"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 pe-12 transition focus:border-accent focus:ring-1 focus:ring-accent focus:outline-none"
              onChange={(event) => setPassword(event.target.value)}
              type={showPassword ? "text" : "password"}
              value={password}
              autoComplete="current-password"
              required
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "login-form-error" : undefined}
            />
            <button
              className="absolute top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:text-slate-600 end-3"
              onClick={() => setShowPassword((prev) => !prev)}
              type="button"
              aria-label={showPassword ? t("hidePassword") : t("showPassword")}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        {error ? <FormAlert message={error} /> : null}
        <button
          className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          type="submit"
          disabled={loading}
          aria-describedby={error ? "login-form-error" : undefined}
        >
          {loading ? "…" : t("login")}
        </button>
        {error ? <p id="login-form-error" className="sr-only">{error}</p> : null}
        <div className="flex justify-end text-sm text-slate-600">
          <Link className="transition hover:text-accent" to="/setup">{t("desktopSetupLink")}</Link>
        </div>
      </form>
    </AuthShell>
  );
}
