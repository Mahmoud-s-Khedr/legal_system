import { useState } from "react";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { usePortalAuthStore } from "../../store/portalAuthStore";
import { Field, FormAlert, PrimaryButton, SectionCard } from "../app/ui";
import { ShellFooter } from "../../components/navigation/ShellFooter";
import { BackToTopButton } from "../../components/navigation/BackToTopButton";
import { buildAuthShellFooterLinks } from "../../components/navigation/shellFooterLinks";

export function PortalLoginPage() {
  const { t } = useTranslation(["app", "auth"]);
  const navigate = useNavigate();
  const { firmId } = useParams({ from: "/portal/$firmId/login" });
  const login = usePortalAuthStore((s) => s.login);
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const footerLinks = buildAuthShellFooterLinks((key) => t(key));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await login(form.email, firmId, form.password);
      void navigate({ to: "/portal/dashboard" });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("errors.fallback"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-sand">
      <div className="mx-auto flex min-h-[calc(100vh-124px)] max-w-7xl items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-4 text-center">
            <Link
              to="/"
              className="font-heading text-xl font-bold tracking-tight text-accent transition hover:text-accent-hover"
            >
              ELMS
            </Link>
          </div>
          <SectionCard
            title={t("portal.clientPortal")}
            description={t("portal.loginDescription")}
          >
            <form className="space-y-4" onSubmit={handleSubmit}>
              <Field
                autoComplete="email"
                label={t("auth:email")}
                required
                type="email"
                value={form.email}
                onChange={(value) =>
                  setForm((current) => ({ ...current, email: value }))
                }
              />
              <Field
                autoComplete="current-password"
                label={t("auth:password")}
                required
                type="password"
                value={form.password}
                onChange={(value) =>
                  setForm((current) => ({ ...current, password: value }))
                }
              />
              {error ? <FormAlert message={error} /> : null}
              <PrimaryButton disabled={loading} type="submit">
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("auth:login")}
              </PrimaryButton>
              <Link
                to="/login"
                className="block text-center text-sm text-slate-500 hover:text-slate-700"
              >
                {t("auth:backToLogin")}
              </Link>
            </form>
          </SectionCard>
        </div>
      </div>
      <ShellFooter ariaLabel={t("footer.navigation")} links={footerLinks} />
      <BackToTopButton label={t("actions.backToTop")} />
    </div>
  );
}
