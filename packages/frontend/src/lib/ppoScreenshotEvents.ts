import type { ToastVariant } from "../store/toastStore";

export const PPO_SCREENSHOT_EVENT = "ppo://screenshot-result";

type PpoScreenshotEventPayload = {
  ok?: boolean;
  path?: string;
  code?: string;
};

type EventPayload<T> = {
  payload: T;
};

type EventApi = {
  listen<T>(event: string, handler: (event: EventPayload<T>) => void): Promise<() => void>;
};

type TranslateFn = (key: string, options?: Record<string, unknown>) => string;

export interface PpoScreenshotEventListenerOptions {
  isDesktopShell: boolean;
  addToast: (message: string, variant?: ToastVariant) => void;
  t: TranslateFn;
  importEventApi?: () => Promise<EventApi>;
}

let hasShownSetupFailureToast = false;

function onScreenshotEvent(
  payload: PpoScreenshotEventPayload | undefined,
  addToast: (message: string, variant?: ToastVariant) => void,
  t: TranslateFn
) {
  if (payload?.ok) {
    addToast(
      payload.path ? t("ppo.status.screenshotSavedAt", { path: payload.path }) : t("ppo.status.screenshotSaved"),
      "success"
    );
    return;
  }

  if (payload?.code === "PPO_WINDOW_NOT_OPEN") {
    addToast(t("ppo.status.windowNotOpen"), "error");
    return;
  }

  addToast(t("ppo.status.navigationFailed"), "error");
}

export function startPpoScreenshotEventListener({
  isDesktopShell,
  addToast,
  t,
  importEventApi = () => import("@tauri-apps/api/event")
}: PpoScreenshotEventListenerOptions): () => void {
  if (!isDesktopShell) {
    return () => {};
  }

  let isActive = true;
  let unlisten: (() => void) | undefined;

  void importEventApi()
    .then(({ listen }) =>
      listen<PpoScreenshotEventPayload>(PPO_SCREENSHOT_EVENT, (event) => {
        if (!isActive) return;
        onScreenshotEvent(event.payload, addToast, t);
      })
    )
    .then((dispose) => {
      if (!isActive) {
        dispose();
        return;
      }
      unlisten = dispose;
    })
    .catch((error) => {
      console.error("[ppo] failed to register screenshot event listener", error);
      if (!hasShownSetupFailureToast) {
        hasShownSetupFailureToast = true;
        addToast(t("ppo.status.navigationFailed"), "error");
      }
    });

  return () => {
    isActive = false;
    if (unlisten) unlisten();
  };
}

export function __resetPpoScreenshotEventListenerForTests() {
  hasShownSetupFailureToast = false;
}
