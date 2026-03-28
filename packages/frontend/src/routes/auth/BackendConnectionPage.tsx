import { FormEvent, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthShell } from "./AuthShell";
import { ApiError, getEffectiveApiBaseUrl, resolveApiUrl, setApiBaseUrlOverride } from "../../lib/api";
import { Field, FormAlert } from "../app/ui";

type TestStatus = "idle" | "success" | "error";

export function BackendConnectionPage() {
  const { t } = useTranslation("auth");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const current = await getEffectiveApiBaseUrl();
      setBaseUrl(current);
    })();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      await setApiBaseUrlOverride(baseUrl);
      setSaveSuccess(t("backendConnection.saved"));
      setTestStatus("idle");
      setTestMessage(null);
    } catch (error) {
      const code = error instanceof ApiError && typeof error.details === "object" && error.details !== null
        ? (error.details as { code?: string }).code
        : undefined;
      if (code === "BACKEND_URL_INVALID_SCHEME" || code === "BACKEND_URL_INVALID_HOST") {
        setSaveError(t("backendConnection.invalidUrl"));
      } else {
        setSaveError((error as Error).message || t("backendConnection.saveFailed"));
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleTestConnection() {
    setTesting(true);
    setTestStatus("idle");
    setTestMessage(null);
    try {
      const response = await fetch(resolveApiUrl("/api/health"), { credentials: "include" });
      if (!response.ok) {
        setTestStatus("error");
        setTestMessage(t("backendConnection.unreachable"));
        return;
      }
      setTestStatus("success");
      setTestMessage(t("backendConnection.reachable"));
    } catch {
      setTestStatus("error");
      setTestMessage(t("backendConnection.unreachable"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <AuthShell title={t("backendConnection.title")} subtitle={t("backendConnection.subtitle")}>
      <form className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-elevated animate-slide-up" onSubmit={handleSave}>
        <Field
          id="backend-base-url"
          label={t("backendConnection.urlLabel")}
          onChange={setBaseUrl}
          required
          value={baseUrl}
        />
        {saveError ? <FormAlert message={saveError} /> : null}
        {saveSuccess ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{saveSuccess}</p>
        ) : null}
        <button
          className="w-full rounded-2xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          type="submit"
          disabled={saving}
        >
          {saving ? "…" : t("backendConnection.save")}
        </button>
        <button
          className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          type="button"
          onClick={() => void handleTestConnection()}
          disabled={testing}
        >
          {testing ? "…" : t("backendConnection.test")}
        </button>
        {testMessage ? (
          <p
            className={`rounded-xl px-3 py-2 text-sm ${
              testStatus === "success"
                ? "border border-emerald-200 bg-emerald-50 text-emerald-800"
                : "border border-rose-200 bg-rose-50 text-rose-800"
            }`}
          >
            {testMessage}
          </p>
        ) : null}
        <div className="flex justify-between text-sm text-slate-600">
          <Link className="transition hover:text-accent" to="/login">{t("backToLogin")}</Link>
          <Link className="transition hover:text-accent" to="/setup">{t("desktopSetupLink")}</Link>
        </div>
      </form>
    </AuthShell>
  );
}
