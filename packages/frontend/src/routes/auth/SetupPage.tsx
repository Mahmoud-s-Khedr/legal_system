import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { EditionKey } from "@elms/shared";
import { AuthShell } from "./AuthShell";
import { useAuthBootstrap } from "../../store/authStore";
import { Field, FormAlert, SelectField } from "../app/ui";
import { resolveFormValidationError } from "../../lib/formValidation";
import { pickFieldError } from "../../lib/validationErrors";

export function SetupPage() {
  const { t } = useTranslation("auth");
  const { needsSetup, register, setup } = useAuthBootstrap();
  const navigate = useNavigate();
  const [firmName, setFirmName] = useState("");
  const [fullName, setFullName] = useState("");
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
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;
    setError(null);
    setFieldErrors({});
    setIsSubmitting(true);

    try {
      if (needsSetup) {
        await setup({ firmName, fullName, email, password, editionKey });
      } else {
        await register({ firmName, fullName, email, password });
      }
      await navigate({ to: "/app/dashboard" });
    } catch (submitError) {
      const resolved = resolveFormValidationError(
        submitError,
        "An unexpected error occurred. Please try again."
      );
      setError(resolved.message);
      setFieldErrors(resolved.fieldErrors);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AuthShell
      title={needsSetup ? t("setupTitle") : t("registerTitle")}
      subtitle={needsSetup ? t("setupSubtitle") : t("registerSubtitle")}
    >
      <form
        className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-xl"
        onSubmit={handleSubmit}
      >
        <Field
          id="setup-firm-name"
          label={t("firmName")}
          value={firmName}
          onChange={(value) => {
            setFirmName(value);
            setFieldErrors((current) => ({ ...current, firmName: "" }));
          }}
          required
          error={pickFieldError(fieldErrors, ["firmName"]) ?? undefined}
        />
        <Field
          id="setup-full-name"
          label={t("fullName")}
          value={fullName}
          onChange={(value) => {
            setFullName(value);
            setFieldErrors((current) => ({ ...current, fullName: "" }));
          }}
          required
          error={pickFieldError(fieldErrors, ["fullName"]) ?? undefined}
        />
        <Field
          id="setup-email"
          label={t("email")}
          type="email"
          value={email}
          onChange={(value) => {
            setEmail(value);
            setFieldErrors((current) => ({ ...current, email: "" }));
          }}
          required
          error={pickFieldError(fieldErrors, ["email"]) ?? undefined}
        />
        <Field
          id="setup-password"
          label={t("password")}
          type="password"
          value={password}
          onChange={(value) => {
            setPassword(value);
            setFieldErrors((current) => ({ ...current, password: "" }));
          }}
          required
          error={pickFieldError(fieldErrors, ["password"]) ?? undefined}
        />
        {needsSetup ? (
          <SelectField
            id="setup-edition"
            label={t("editionLabel")}
            onChange={(value) => {
              setEditionKey(value as EditionKey);
              setFieldErrors((current) => ({ ...current, editionKey: "" }));
            }}
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
            error={pickFieldError(fieldErrors, ["editionKey"]) ?? undefined}
          />
        ) : null}
        {error ? <FormAlert message={error} /> : null}
        <button
          className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          type="submit"
          disabled={isSubmitting}
        >
          {needsSetup ? t("completeSetup") : t("registerSubmit")}
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
