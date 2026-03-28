import { describe, expect, it, vi } from "vitest";
import { DEFAULT_PPO_PORTAL_URL, launchPpoPortal, navigatePpoPortal } from "./ppoPortal";

describe("launchPpoPortal", () => {
  it("opens PPO in a browser tab in non-desktop mode", async () => {
    const openBrowserTab = vi.fn().mockReturnValue({} as Window);

    const result = await launchPpoPortal({}, { desktopShell: false, openBrowserTab });

    expect(result).toEqual({ ok: true, destination: "browser-tab", reused: false });
    expect(openBrowserTab).toHaveBeenCalledWith(DEFAULT_PPO_PORTAL_URL, "_blank", "noopener,noreferrer");
  });

  it("returns an error when the browser blocks a popup", async () => {
    const openBrowserTab = vi.fn().mockReturnValue(null);

    const result = await launchPpoPortal({}, { desktopShell: false, openBrowserTab });

    expect(result).toEqual({
      ok: false,
      code: "PPO_WEB_POPUP_BLOCKED",
      message: "Could not open the PPO tab. Please allow pop-ups for this site and try again."
    });
  });

  it("reuses an existing desktop PPO window when command returns reused=true", async () => {
    const invokeDesktopLaunch = vi.fn().mockResolvedValue({ ok: true, reused: true });

    const result = await launchPpoPortal({}, { desktopShell: true, invokeDesktopLaunch });

    expect(result).toEqual({ ok: true, destination: "desktop-window", reused: true });
    expect(invokeDesktopLaunch).toHaveBeenCalledTimes(1);
  });

  it("creates a desktop PPO window when command returns reused=false", async () => {
    const invokeDesktopLaunch = vi.fn().mockResolvedValue({ ok: true, reused: false });

    const result = await launchPpoPortal({}, { desktopShell: true, invokeDesktopLaunch });

    expect(result).toEqual({ ok: true, destination: "desktop-window", reused: false });
    expect(invokeDesktopLaunch).toHaveBeenCalledTimes(1);
  });

  it("maps macOS unsupported desktop launch code", async () => {
    const invokeDesktopLaunch = vi
      .fn()
      .mockResolvedValue({ ok: false, code: "PPO_TLS_BYPASS_UNSUPPORTED_MACOS" as const });

    const result = await launchPpoPortal({}, { desktopShell: true, invokeDesktopLaunch });

    expect(result).toEqual({ ok: false, code: "PPO_TLS_BYPASS_UNSUPPORTED_MACOS" });
  });

  it("returns a desktop launch error when command invocation fails", async () => {
    const invokeDesktopLaunch = vi.fn().mockRejectedValue(new Error("Window API unavailable"));

    const result = await launchPpoPortal({}, { desktopShell: true, invokeDesktopLaunch });

    expect(result).toEqual({
      ok: false,
      code: "PPO_DESKTOP_LAUNCH_FAILED",
      message: "Window API unavailable"
    });
  });
});

describe("navigatePpoPortal", () => {
  it("invokes ppo_portal_navigate with the given action and returns success", async () => {
    const invokeNav = vi.fn().mockResolvedValue({ ok: true, action: "back" });

    const result = await navigatePpoPortal("back", { invokeNav });

    expect(invokeNav).toHaveBeenCalledWith("back");
    expect(result).toEqual({ ok: true, action: "back", url: undefined });
  });

  it("passes url through on success when present", async () => {
    const invokeNav = vi
      .fn()
      .mockResolvedValue({ ok: true, action: "get_state", url: "https://ppo.gov.eg/some/page" });

    const result = await navigatePpoPortal("get_state", { invokeNav });

    expect(result).toEqual({ ok: true, action: "get_state", url: "https://ppo.gov.eg/some/page" });
  });

  it("supports screenshot action responses", async () => {
    const invokeNav = vi
      .fn()
      .mockResolvedValue({ ok: true, action: "screenshot", url: "/home/user/Downloads/ppo.png" });

    const result = await navigatePpoPortal("screenshot", { invokeNav });

    expect(invokeNav).toHaveBeenCalledWith("screenshot");
    expect(result).toEqual({ ok: true, action: "screenshot", url: "/home/user/Downloads/ppo.png" });
  });

  it("passes PPO_WINDOW_NOT_OPEN error code through", async () => {
    const invokeNav = vi
      .fn()
      .mockResolvedValue({ ok: false, code: "PPO_WINDOW_NOT_OPEN" as const });

    const result = await navigatePpoPortal("reload", { invokeNav });

    expect(result).toEqual({ ok: false, code: "PPO_WINDOW_NOT_OPEN" });
  });

  it("passes PPO_NAVIGATION_FAILED error code through", async () => {
    const invokeNav = vi
      .fn()
      .mockResolvedValue({ ok: false, code: "PPO_NAVIGATION_FAILED" as const });

    const result = await navigatePpoPortal("forward", { invokeNav });

    expect(result).toEqual({ ok: false, code: "PPO_NAVIGATION_FAILED" });
  });

  it("wraps a thrown invocation error as PPO_NAVIGATION_FAILED", async () => {
    const invokeNav = vi.fn().mockRejectedValue(new Error("IPC channel closed"));

    const result = await navigatePpoPortal("back", { invokeNav });

    expect(result).toEqual({ ok: false, code: "PPO_NAVIGATION_FAILED" });
  });
});
