import { FormEvent, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthShell } from "./AuthShell";
import { useAuthBootstrap } from "../../store/authStore";
import { Field, FormAlert } from "../app/ui";

export function SetupPage() {
  const { t } = useTranslation("auth");
  const { setup } = useAuthBootstrap();
  const navigate = useNavigate();
  const [firmName, setFirmName] = useState("ELMS Desktop Firm");
  const [fullName, setFullName] = useState("Desktop Admin");
  const [email, setEmail] = useState(import.meta.env.VITE_SETUP_EMAIL as string ?? "");
  const [password, setPassword] = useState(import.meta.env.VITE_SETUP_PASSWORD as string ?? "");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    try {
      await setup({ firmName, fullName, email, password });
      await navigate({ to: "/app/dashboard" });
    } catch (submitError) {
      setError((submitError as Error).message);
    }
  }

  return (
    <AuthShell title={t("setupTitle")} subtitle={t("setupSubtitle")}>
      <form className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-xl" onSubmit={handleSubmit}>
        <Field id="setup-firm-name" label={t("firmName")} value={firmName} onChange={setFirmName} required />
        <Field id="setup-full-name" label={t("fullName")} value={fullName} onChange={setFullName} required />
        <Field id="setup-email" label={t("email")} type="email" value={email} onChange={setEmail} required />
        <Field id="setup-password" label={t("password")} type="password" value={password} onChange={setPassword} required />
        {error ? <FormAlert message={error} /> : null}
        <button className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-white" type="submit">
          {t("completeSetup")}
        </button>
        <Link
          to="/login"
          className="block text-center text-sm text-slate-500 hover:text-slate-700"
        >
          {t("backToLogin")}
        </Link>
      </form>
    </AuthShell>
  );
}
