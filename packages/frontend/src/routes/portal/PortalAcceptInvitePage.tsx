import { useState } from "react";
import { useSearch, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Field, FormAlert, PrimaryButton, SectionCard } from "../app/ui";

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
    <div className="flex min-h-screen items-center justify-center bg-sand px-4">
      <div className="w-full max-w-md">
        <SectionCard title={t("portal.acceptInvite")} description={t("portal.setPasswordHint")}>
          {done ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <CheckCircle2 className="size-10 text-green-500" />
              <p className="text-sm font-semibold text-green-700">{t("portal.passwordSet")}</p>
            </div>
          ) : (
            <>
              {error ? <FormAlert message={error} /> : null}
              <form className="space-y-4" onSubmit={handleSubmit}>
                <Field
                  label={t("auth.newPassword")}
                  minLength={8}
                  required
                  type="password"
                  value={password}
                  onChange={setPassword}
                />
                <Field
                  label={t("auth.confirmPassword")}
                  minLength={8}
                  required
                  type="password"
                  value={confirm}
                  onChange={setConfirm}
                />
                <PrimaryButton disabled={loading || !search.token} type="submit">
                  {loading && <Loader2 className="size-4 animate-spin" />}
                  {t("portal.setPassword")}
                </PrimaryButton>
              </form>
            </>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
