export const DEFAULT_PPO_PORTAL_URL = "https://ppo.gov.eg/ppo/r/ppoportal/ppoportal/home";

export type PpoPortalLaunchErrorCode = "PPO_WEB_POPUP_BLOCKED";

export interface PpoPortalLaunchSuccessResult {
  ok: true;
  destination: "browser-tab";
  reused: boolean;
}

export interface PpoPortalLaunchErrorResult {
  ok: false;
  code: PpoPortalLaunchErrorCode;
  message?: string;
}

export type PpoPortalLaunchResult = PpoPortalLaunchSuccessResult | PpoPortalLaunchErrorResult;

interface LaunchDeps {
  openBrowserTab?: (url: string, target: string, features: string) => Window | null;
}

export async function launchPpoPortal(
  { url = DEFAULT_PPO_PORTAL_URL }: { url?: string } = {},
  deps: LaunchDeps = {}
): Promise<PpoPortalLaunchResult> {
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
