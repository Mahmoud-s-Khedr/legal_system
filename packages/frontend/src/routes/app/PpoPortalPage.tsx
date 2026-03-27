import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  launchPpoPortal,
  navigatePpoPortal,
  type PpoPortalLaunchErrorCode,
  type PpoPortalLaunchResult,
  type PpoPortalNavAction,
  type PpoPortalNavErrorCode
} from "../../lib/ppoPortal";
import { PageHeader, SectionCard } from "./ui";

const isDesktop = import.meta.env.VITE_DESKTOP_SHELL === "true";

type LaunchState =
  | { status: "idle" }
  | { status: "launching" }
  | { status: "success"; result: Extract<PpoPortalLaunchResult, { ok: true }> }
  | { status: "error"; code: PpoPortalLaunchErrorCode; message?: string };

type NavState =
  | { status: "idle" }
  | { status: "navigating" }
  | { status: "error"; code: PpoPortalNavErrorCode }
  | { status: "window_not_open" };

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

function resolveNavStatusMessage(t: (key: string) => string, state: NavState): string | null {
  if (state.status === "idle") return null;
  if (state.status === "navigating") return t("ppo.status.navigating");
  if (state.status === "window_not_open") return t("ppo.status.windowNotOpen");
  return t("ppo.status.navigationFailed");
}

export function PpoPortalPage() {
  const { t } = useTranslation("app");
  const [launchState, setLaunchState] = useState<LaunchState>({ status: "idle" });
  const [hasOpenedAtLeastOnce, setHasOpenedAtLeastOnce] = useState(false);
  const [navState, setNavState] = useState<NavState>({ status: "idle" });

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

  const handleNav = useCallback(async (action: PpoPortalNavAction) => {
    setNavState({ status: "navigating" });
    const result = await navigatePpoPortal(action);
    if (result.ok) {
      setNavState({ status: "idle" });
      return;
    }
    if (result.code === "PPO_WINDOW_NOT_OPEN") {
      setNavState({ status: "window_not_open" });
      return;
    }
    setNavState({ status: "error", code: result.code });
    setTimeout(() => setNavState({ status: "idle" }), 3000);
  }, []);

  useEffect(() => {
    void openPortal();
  }, [openPortal]);

  useEffect(() => {
    if (!isDesktop) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        document.activeElement?.getAttribute("contenteditable") === "true"
      ) {
        return;
      }

      if (e.altKey && e.key === "ArrowLeft") {
        void handleNav("back");
        return;
      }
      if (e.altKey && e.key === "ArrowRight") {
        void handleNav("forward");
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "r") {
        e.preventDefault();
        void handleNav("reload");
        return;
      }
      if (e.altKey && e.key === "Home") {
        void handleNav("home");
        return;
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleNav]);

  const statusMessage = useMemo(() => resolveStatusMessage(t, launchState), [launchState, t]);

  const navButtons = [
    ["back", "ppo.nav.back", "ppo.nav.backHint"],
    ["forward", "ppo.nav.forward", "ppo.nav.forwardHint"],
    ["reload", "ppo.nav.reload", "ppo.nav.reloadHint"],
    ["home", "ppo.nav.home", "ppo.nav.homeHint"],
    ["open_external", "ppo.nav.openExternal", null]
  ] as const;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("ppo.eyebrow")}
        title={t("ppo.title")}
        description={t("ppo.description")}
      />

      {isDesktop && (
        <SectionCard title={t("ppo.nav.sectionTitle")}>
          <div className="flex flex-wrap items-center gap-2">
            {navButtons.map(([action, labelKey, hintKey]) => (
              <button
                key={action}
                type="button"
                data-action={action}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                disabled={navState.status === "navigating"}
                onClick={() => {
                  void handleNav(action);
                }}
                title={hintKey ? t(hintKey) : undefined}
              >
                {t(labelKey)}
                {hintKey && <span className="text-xs text-slate-400">{t(hintKey)}</span>}
              </button>
            ))}
          </div>

          {navState.status !== "idle" && (
            <div className="mt-3 space-y-2">
              <p
                className={
                  navState.status === "error" || navState.status === "window_not_open"
                    ? "text-sm font-medium text-red-700"
                    : "text-sm text-slate-700"
                }
                role="status"
                aria-live="polite"
              >
                {resolveNavStatusMessage(t, navState)}
              </p>
              {navState.status === "window_not_open" && (
                <button
                  type="button"
                  className="text-sm font-medium text-accent underline underline-offset-2"
                  onClick={() => {
                    void openPortal();
                  }}
                >
                  {t("ppo.status.returnToHome")}
                </button>
              )}
            </div>
          )}
        </SectionCard>
      )}

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
        </div>
      </SectionCard>
    </div>
  );
}
