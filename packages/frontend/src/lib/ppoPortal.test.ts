import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PPO_PORTAL_URL, launchPpoPortal } from "./ppoPortal";

describe("launchPpoPortal", () => {
  it("opens PPO in a browser tab", async () => {
    const openBrowserTab = vi.fn().mockReturnValue({} as Window);

    const result = await launchPpoPortal({}, { openBrowserTab });

    expect(result).toEqual({ ok: true, destination: "browser-tab", reused: false });
    expect(openBrowserTab).toHaveBeenCalledWith(DEFAULT_PPO_PORTAL_URL, "_blank", "noopener,noreferrer");
  });

  it("returns an error when the browser blocks a popup", async () => {
    const openBrowserTab = vi.fn().mockReturnValue(null);

    const result = await launchPpoPortal({}, { openBrowserTab });

    expect(result).toEqual({
      ok: false,
      code: "PPO_WEB_POPUP_BLOCKED",
      message: "Could not open the PPO tab. Please allow pop-ups for this site and try again."
    });
  });

  it("passes override url through", async () => {
    const openBrowserTab = vi.fn().mockReturnValue({} as Window);

    await launchPpoPortal({ url: "https://example.test/ppo" }, { openBrowserTab });

    expect(openBrowserTab).toHaveBeenCalledWith("https://example.test/ppo", "_blank", "noopener,noreferrer");
  });
});
