export const DEFAULT_PPO_PORTAL_URL = "https://ppo.gov.eg/ppo/r/ppoportal/ppoportal/home";

export type PpoPortalLaunchErrorCode =
  | "PPO_TLS_BYPASS_UNSUPPORTED_MACOS"
  | "PPO_DESKTOP_LAUNCH_FAILED"
  | "PPO_WEB_POPUP_BLOCKED";

export interface PpoPortalLaunchSuccessResult {
  ok: true;
  destination: "desktop-window" | "browser-tab";
  reused: boolean;
}

export interface PpoPortalLaunchErrorResult {
  ok: false;
  code: PpoPortalLaunchErrorCode;
  message?: string;
}

export type PpoPortalLaunchResult = PpoPortalLaunchSuccessResult | PpoPortalLaunchErrorResult;

type DesktopLaunchCommandResult =
  | { ok: true; reused: boolean }
  | { ok: false; code: "PPO_TLS_BYPASS_UNSUPPORTED_MACOS" | "PPO_DESKTOP_LAUNCH_FAILED" };

interface LaunchDeps {
  desktopShell?: boolean;
  openBrowserTab?: (url: string, target: string, features: string) => Window | null;
  invokeDesktopLaunch?: () => Promise<DesktopLaunchCommandResult>;
}

function isDesktopShellEnabled() {
  return import.meta.env.VITE_DESKTOP_SHELL === "true";
}

function normalizeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallback;
}

async function invokeDefaultDesktopLaunch(): Promise<DesktopLaunchCommandResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<DesktopLaunchCommandResult>("open_ppo_portal_window");
}

export async function launchPpoPortal(
  { url = DEFAULT_PPO_PORTAL_URL }: { url?: string } = {},
  deps: LaunchDeps = {}
): Promise<PpoPortalLaunchResult> {
  const desktopShell = deps.desktopShell ?? isDesktopShellEnabled();

  if (desktopShell) {
    try {
      const invokeDesktopLaunch = deps.invokeDesktopLaunch ?? invokeDefaultDesktopLaunch;
      const desktopResult = await invokeDesktopLaunch();

      if (desktopResult.ok) {
        return { ok: true, destination: "desktop-window", reused: desktopResult.reused };
      }

      return { ok: false, code: desktopResult.code };
    } catch (error) {
      return {
        ok: false,
        code: "PPO_DESKTOP_LAUNCH_FAILED",
        message: normalizeErrorMessage(error, "Could not open the PPO managed window.")
      };
    }
  }

  const openBrowserTab = deps.openBrowserTab ?? ((nextUrl, target, features) => window.open(nextUrl, target, features));
  const popup = openBrowserTab(url, "_blank", "noopener,noreferrer");

  if (!popup) {
    return {
      ok: false,
      code: "PPO_WEB_POPUP_BLOCKED",
      message: "Could not open the PPO tab. Please allow pop-ups for this site and try again."
    };
  }

  return { ok: true, destination: "browser-tab", reused: false };
}

export type PpoPortalNavAction =
  | "back"
  | "forward"
  | "reload"
  | "home"
  | "open_external"
  | "get_state";

export type PpoPortalNavErrorCode =
  | "PPO_WINDOW_NOT_OPEN"
  | "PPO_NAVIGATION_FAILED"
  | "PPO_URL_UNAVAILABLE";

type NavCommandResult =
  | { ok: true; action: string; url?: string }
  | { ok: false; code: PpoPortalNavErrorCode };

export type PpoPortalNavResult =
  | { ok: true; action: PpoPortalNavAction; url?: string }
  | { ok: false; code: PpoPortalNavErrorCode };

interface NavDeps {
  invokeNav?: (action: string) => Promise<NavCommandResult>;
}

async function invokeDefaultNav(action: string): Promise<NavCommandResult> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<NavCommandResult>("ppo_portal_navigate", { action });
}

export async function navigatePpoPortal(
  action: PpoPortalNavAction,
  deps: NavDeps = {}
): Promise<PpoPortalNavResult> {
  try {
    const invokeNav = deps.invokeNav ?? invokeDefaultNav;
    const result = await invokeNav(action);
    if (result.ok) {
      return { ok: true, action: result.action as PpoPortalNavAction, url: result.url };
    }
    return { ok: false, code: result.code };
  } catch {
    return { ok: false, code: "PPO_NAVIGATION_FAILED" };
  }
}
