import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { usePortalAuthStore } from "../../store/portalAuthStore";
import { Field, FormAlert, PrimaryButton, SectionCard } from "../app/ui";

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
      setError(err instanceof Error ? err.message : t("errors.fallback"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-md">
        <SectionCard title={t("portal.clientPortal")} description={t("portal.loginDescription")}>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <Field
              autoComplete="email"
              label={t("auth.email")}
              required
              type="email"
              value={form.email}
              onChange={(value) => setForm((current) => ({ ...current, email: value }))}
            />
            <Field
              hint={t("portal.firmIdHint")}
              label={t("portal.firmId")}
              required
              value={form.firmId}
              onChange={(value) => setForm((current) => ({ ...current, firmId: value }))}
            />
            <Field
              autoComplete="current-password"
              label={t("auth.password")}
              required
              type="password"
              value={form.password}
              onChange={(value) => setForm((current) => ({ ...current, password: value }))}
            />
            {error ? <FormAlert message={error} /> : null}
            <PrimaryButton disabled={loading} type="submit">
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("auth.login")}
            </PrimaryButton>
          </form>
        </SectionCard>
      </div>
    </div>
  );
}
