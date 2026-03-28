import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  launchPpoPortal,
  navigatePpoPortal,
  type PpoPortalLaunchErrorCode,
  type PpoPortalLaunchResult
} from "../../lib/ppoPortal";
import { PageHeader, SectionCard } from "./ui";

type LaunchState =
  | { status: "idle" }
  | { status: "launching" }
  | { status: "success"; result: Extract<PpoPortalLaunchResult, { ok: true }> }
  | { status: "error"; code: PpoPortalLaunchErrorCode; message?: string };

function resolveStatusMessage(t: (key: string) => string, state: LaunchState): string {
  if (state.status === "idle" || state.status === "launching") {
    return t("ppo.status.opening");
  }

  if (state.status === "error") {
    if (state.code === "PPO_TLS_BYPASS_UNSUPPORTED_MACOS") {
      return t("ppo.status.macosTlsUnsupported");
    }

    if (state.message) {
      return `${t("ppo.status.failed")} ${state.message}`;
    }

    return t("ppo.status.failed");
  }

  if (state.result.destination === "desktop-window") {
    return state.result.reused ? t("ppo.status.focusedWindow") : t("ppo.status.openedWindow");
  }

  return t("ppo.status.openedTab");
}

export function PpoPortalPage() {
  const { t } = useTranslation("app");
  const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";
  const [launchState, setLaunchState] = useState<LaunchState>({ status: "idle" });
  const [hasOpenedAtLeastOnce, setHasOpenedAtLeastOnce] = useState(false);
  const [isTakingScreenshot, setIsTakingScreenshot] = useState(false);

  const openPortal = useCallback(async () => {
    setLaunchState({ status: "launching" });

    const result = await launchPpoPortal();
    if (result.ok) {
      setHasOpenedAtLeastOnce(true);
      setLaunchState({ status: "success", result });
      return;
    }

    setLaunchState({ status: "error", code: result.code, message: result.message });
  }, []);

  useEffect(() => {
    void openPortal();
  }, [openPortal]);

  const statusMessage = useMemo(() => resolveStatusMessage(t, launchState), [launchState, t]);

  const handleScreenshot = useCallback(async () => {
    setIsTakingScreenshot(true);
    try {
      await navigatePpoPortal("screenshot");
    } finally {
      setIsTakingScreenshot(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("ppo.eyebrow")}
        title={t("ppo.title")}
        description={t("ppo.description")}
      />

      <SectionCard title={t("ppo.launchSectionTitle")} description={t("ppo.launchSectionDescription")}>
        <div className="space-y-4">
          <p className="text-sm text-slate-600">{t("ppo.sessionNote")}</p>
          <p
            className={launchState.status === "error" ? "text-sm font-medium text-red-700" : "text-sm text-slate-700"}
            role="status"
            aria-live="polite"
          >
            {statusMessage}
          </p>

          <button
            className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50"
            disabled={launchState.status === "launching"}
            onClick={() => {
              void openPortal();
            }}
            type="button"
          >
            {hasOpenedAtLeastOnce ? t("ppo.reopenAction") : t("ppo.openAction")}
          </button>

          {isDesktopShell ? (
            <button
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-accent disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isTakingScreenshot}
              onClick={() => {
                void handleScreenshot();
              }}
              type="button"
              data-action="screenshot"
            >
              {isTakingScreenshot ? t("ppo.status.navigating") : t("ppo.nav.screenshot")}
            </button>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
