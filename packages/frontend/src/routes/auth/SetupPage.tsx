import { FormEvent, useState } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { EditionKey } from "@elms/shared";
import { AuthShell } from "./AuthShell";
import { useAuthBootstrap } from "../../store/authStore";
import { Field, FormAlert, SelectField } from "../app/ui";

export function SetupPage() {
  const { t } = useTranslation("auth");
  const { setup } = useAuthBootstrap();
  const navigate = useNavigate();
  const [firmName, setFirmName] = useState("ELMS Desktop Firm");
  const [fullName, setFullName] = useState("Desktop Admin");
  const [email, setEmail] = useState(
    (import.meta.env.VITE_SETUP_EMAIL as string) ?? ""
  );
  const [password, setPassword] = useState(
    (import.meta.env.VITE_SETUP_PASSWORD as string) ?? ""
  );
  const [editionKey, setEditionKey] = useState<EditionKey>(
    EditionKey.SOLO_OFFLINE
  );
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setIsSubmitting(true);

    try {
      await setup({ firmName, fullName, email, password, editionKey });
      await navigate({ to: "/app/dashboard" });
    } catch (submitError) {
      setError((submitError as Error).message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell title={t("setupTitle")} subtitle={t("setupSubtitle")}>
      <form
        className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-xl"
        onSubmit={handleSubmit}
      >
        <Field
          id="setup-firm-name"
          label={t("firmName")}
          value={firmName}
          onChange={setFirmName}
          required
        />
        <Field
          id="setup-full-name"
          label={t("fullName")}
          value={fullName}
          onChange={setFullName}
          required
        />
        <Field
          id="setup-email"
          label={t("email")}
          type="email"
          value={email}
          onChange={setEmail}
          required
        />
        <Field
          id="setup-password"
          label={t("password")}
          type="password"
          value={password}
          onChange={setPassword}
          required
        />
        <SelectField
          id="setup-edition"
          label={t("editionLabel")}
          onChange={(value) => setEditionKey(value as EditionKey)}
          options={[
            {
              value: EditionKey.SOLO_OFFLINE,
              label: t("editionOptions.solo_offline")
            },
            {
              value: EditionKey.SOLO_ONLINE,
              label: t("editionOptions.solo_online")
            },
            {
              value: EditionKey.LOCAL_FIRM_OFFLINE,
              label: t("editionOptions.local_firm_offline")
            },
            {
              value: EditionKey.LOCAL_FIRM_ONLINE,
              label: t("editionOptions.local_firm_online")
            }
          ]}
          value={editionKey}
        />
        {error ? <FormAlert message={error} /> : null}
        <button
          className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
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
