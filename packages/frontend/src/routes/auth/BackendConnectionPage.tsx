import { useEffect, useState, type FormEvent } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AuthShell } from "./AuthShell";
import {
  ApiError,
  captureDesktopConnectivitySnapshot,
  getDesktopBackendNetworkStatus,
  getConfiguredApiBaseUrl,
  setApiBaseUrlOverride
} from "../../lib/api";
import { Field, FormAlert } from "../app/ui";

type TestStatus = "idle" | "success" | "error";

function isLikelyPrivateNetworkHost(hostname: string) {
  return (
    /^10\./.test(hostname) ||
    /^127\./.test(hostname) ||
    /^192\.168\./.test(hostname) ||
    /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname) ||
    hostname === "localhost"
  );
}

export function buildConnectionDiagnostics(requestUrl: string) {
  let requestOrigin: string | null = null;
  let hostname: string | null = null;

  try {
    const parsed = new URL(requestUrl);
    requestOrigin = parsed.origin;
    hostname = parsed.hostname;
  } catch {
    // Keep nulls; snapshot will still help.
  }

  const isPrivateNetworkTarget = hostname ? isLikelyPrivateNetworkHost(hostname) : null;

  return {
    requestUrl,
    requestOrigin: window.location.origin,
    targetOrigin: requestOrigin,
    isSecureContext:
      typeof window !== "undefined"
        ? Boolean(window.isSecureContext)
        : Boolean(globalThis.isSecureContext),
    targetIsPrivateNetwork: isPrivateNetworkTarget,
    webviewOrigin: window.location.origin
  };
}

export function BackendConnectionPage() {
  const { t } = useTranslation("auth");
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [loopbackUrl, setLoopbackUrl] = useState<string>("");
  const [lanUrl, setLanUrl] = useState<string | null>(null);
  const [exposureMode, setExposureMode] = useState<"localhost" | "lan">(
    "localhost"
  );
  const [copiedLan, setCopiedLan] = useState(false);

  useEffect(() => {
    void (async () => {
      const current = await getConfiguredApiBaseUrl();
      const networkStatus = await getDesktopBackendNetworkStatus();
      setBaseUrl(current);
      if (networkStatus) {
        setLoopbackUrl(networkStatus.loopbackUrl);
        setLanUrl(networkStatus.lanUrl);
        setExposureMode(networkStatus.exposureMode);
      }
    })();
  }, []);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const saved = await setApiBaseUrlOverride(baseUrl);
      const typedNormalized = (() => {
        try { return new URL(baseUrl.trim()).origin; } catch { return null; }
      })();
      if (saved && typedNormalized && baseUrl.trim() !== saved) {
        // The user typed a URL with a path — it was silently stripped. Show a notice.
        setSaveSuccess(
          t("backendConnection.savedNormalized", { url: saved, defaultValue: `Saved (normalized to: ${saved})` })
        );
      } else {
        setSaveSuccess(t("backendConnection.saved"));
      }
      setTestStatus("idle");
      setTestMessage(null);
    } catch (error) {
      const code =
        error instanceof ApiError &&
        typeof error.details === "object" &&
        error.details !== null
          ? (error.details as { code?: string }).code
          : undefined;
      if (
        code === "BACKEND_URL_INVALID_SCHEME" ||
        code === "BACKEND_URL_INVALID_HOST" ||
        code === "BACKEND_URL_EMPTY"
      ) {
        setSaveError(t("backendConnection.invalidUrl"));
      } else {
        setSaveError(
          (error as Error).message || t("backendConnection.saveFailed")
        );
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
      const nextBaseUrl = baseUrl.trim();
      if (!nextBaseUrl) {
        setTestStatus("error");
        setTestMessage(t("backendConnection.invalidUrl"));
        return;
      }
      // Always test against the origin only — discard any path the user may have typed.
      const testOrigin = (() => {
        try { return new URL(nextBaseUrl).origin; } catch { return nextBaseUrl.replace(/\/+$/, ""); }
      })();
      const requestUrl = `${testOrigin}/api/health`;
      const diagnostics = buildConnectionDiagnostics(requestUrl);
      const response = await fetch(requestUrl, { credentials: "include" });
      if (!response.ok) {
        captureDesktopConnectivitySnapshot({
          reason: "BACKEND_CONNECTION_TEST_NON_OK",
          failureKind: "http-error",
          hadHttpResponse: true,
          responseStatus: response.status,
          responseOk: response.ok,
          ...diagnostics
        });
        setTestStatus("error");
        setTestMessage(t("backendConnection.unreachable"));
        return;
      }
      setTestStatus("success");
      setTestMessage(t("backendConnection.reachable"));
    } catch {
      const nextBaseUrl = baseUrl.trim();
      const testOrigin = (() => {
        try { return new URL(nextBaseUrl).origin; } catch { return nextBaseUrl.replace(/\/+$/, ""); }
      })();
      const requestUrl =
        testOrigin && testOrigin.length > 0 ? `${testOrigin}/api/health` : null;
      captureDesktopConnectivitySnapshot({
        reason: "BACKEND_CONNECTION_TEST_FETCH_FAILED",
        requestUrl,
        failureKind: "network-or-cors",
        hadHttpResponse: false,
        likelyBlockedStage: "preflight-or-fetch",
        ...(requestUrl ? buildConnectionDiagnostics(requestUrl) : {})
      });
      setTestStatus("error");
      setTestMessage(t("backendConnection.unreachable"));
    } finally {
      setTesting(false);
    }
  }

  return (
    <AuthShell
      title={t("backendConnection.title")}
      subtitle={t("backendConnection.subtitle")}
    >
      <form
        className="w-full max-w-md space-y-4 rounded-3xl bg-white p-8 shadow-elevated animate-slide-up"
        onSubmit={handleSave}
      >
        <Field
          id="backend-base-url"
          label={t("backendConnection.urlLabel")}
          onChange={setBaseUrl}
          required
          value={baseUrl}
        />
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            {t("backendConnection.localNetworkUrlLabel")}
          </p>
          <p className="mt-1 text-sm font-medium text-slate-800" dir="ltr">
            {lanUrl ?? t("backendConnection.localNetworkUnavailable")}
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {exposureMode === "lan"
              ? t("backendConnection.localNetworkEnabledWarning")
              : t("backendConnection.localNetworkDisabledHint")}
          </p>
          <p className="mt-1 text-xs text-slate-500" dir="ltr">
            {t("backendConnection.loopbackUrlLabel")}: {loopbackUrl || "http://127.0.0.1:7854"}
          </p>
          <button
            className="mt-2 rounded-xl border border-slate-300 bg-white px-2 py-1 text-xs font-semibold text-slate-700 disabled:opacity-50"
            type="button"
            disabled={!lanUrl}
            onClick={async () => {
              if (!lanUrl) {
                return;
              }
              try {
                await navigator.clipboard.writeText(lanUrl);
                setCopiedLan(true);
                window.setTimeout(() => setCopiedLan(false), 1500);
              } catch {
                setCopiedLan(false);
              }
            }}
          >
            {copiedLan
              ? t("backendConnection.localNetworkCopied")
              : t("backendConnection.copyLocalNetworkUrl")}
          </button>
        </div>
        {saveError ? <FormAlert message={saveError} /> : null}
        {saveSuccess ? (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {saveSuccess}
          </p>
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
          <Link className="transition hover:text-accent" to="/login">
            {t("backToLogin")}
          </Link>
          <Link className="transition hover:text-accent" to="/setup">
            {t("desktopSetupLink")}
          </Link>
        </div>
      </form>
    </AuthShell>
  );
}
