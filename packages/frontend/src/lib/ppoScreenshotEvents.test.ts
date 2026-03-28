import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetPpoScreenshotEventListenerForTests,
  PPO_SCREENSHOT_EVENT,
  startPpoScreenshotEventListener
} from "./ppoScreenshotEvents";

function flush() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("startPpoScreenshotEventListener", () => {
  beforeEach(() => {
    __resetPpoScreenshotEventListenerForTests();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("does nothing when desktop shell is disabled", async () => {
    const addToast = vi.fn();
    const importEventApi = vi.fn();

    startPpoScreenshotEventListener({
      isDesktopShell: false,
      addToast,
      t: (key) => key,
      importEventApi
    });

    await flush();

    expect(importEventApi).not.toHaveBeenCalled();
    expect(addToast).not.toHaveBeenCalled();
  });

  it("shows success toast with path on screenshot success", async () => {
    const addToast = vi.fn();
    let handler: ((event: { payload: { ok?: boolean; path?: string } }) => void) | null = null;

    const importEventApi = vi.fn().mockResolvedValue({
      listen: vi.fn().mockImplementation((eventName: string, nextHandler) => {
        handler = nextHandler;
        expect(eventName).toBe(PPO_SCREENSHOT_EVENT);
        return Promise.resolve(() => {});
      })
    });

    startPpoScreenshotEventListener({
      isDesktopShell: true,
      addToast,
      t: (key, options) => {
        if (key === "ppo.status.screenshotSavedAt") {
          return `saved:${String(options?.path ?? "")}`;
        }
        return key;
      },
      importEventApi
    });

    await flush();
    expect(handler).not.toBeNull();
    if (!handler) {
      throw new Error("missing listener handler");
    }
    const screenshotHandler = handler as (event: { payload: { ok?: boolean; path?: string } }) => void;
    screenshotHandler({ payload: { ok: true, path: "/tmp/screenshot.png" } });

    expect(addToast).toHaveBeenCalledWith("saved:/tmp/screenshot.png", "success");
  });

  it("shows window-not-open toast for PPO_WINDOW_NOT_OPEN", async () => {
    const addToast = vi.fn();
    let handler: ((event: { payload: { ok?: boolean; code?: string } }) => void) | null = null;

    const importEventApi = vi.fn().mockResolvedValue({
      listen: vi.fn().mockImplementation((_eventName: string, nextHandler) => {
        handler = nextHandler;
        return Promise.resolve(() => {});
      })
    });

    startPpoScreenshotEventListener({
      isDesktopShell: true,
      addToast,
      t: (key) => key,
      importEventApi
    });

    await flush();
    expect(handler).not.toBeNull();
    if (!handler) {
      throw new Error("missing listener handler");
    }
    const screenshotHandler = handler as (event: { payload: { ok?: boolean; code?: string } }) => void;
    screenshotHandler({ payload: { ok: false, code: "PPO_WINDOW_NOT_OPEN" } });

    expect(addToast).toHaveBeenCalledWith("ppo.status.windowNotOpen", "error");
  });

  it("shows generic navigation failure toast for unknown screenshot error", async () => {
    const addToast = vi.fn();
    let handler: ((event: { payload: { ok?: boolean; code?: string } }) => void) | null = null;

    const importEventApi = vi.fn().mockResolvedValue({
      listen: vi.fn().mockImplementation((_eventName: string, nextHandler) => {
        handler = nextHandler;
        return Promise.resolve(() => {});
      })
    });

    startPpoScreenshotEventListener({
      isDesktopShell: true,
      addToast,
      t: (key) => key,
      importEventApi
    });

    await flush();
    expect(handler).not.toBeNull();
    if (!handler) {
      throw new Error("missing listener handler");
    }
    const screenshotHandler = handler as (event: { payload: { ok?: boolean; code?: string } }) => void;
    screenshotHandler({ payload: { ok: false, code: "PPO_SCREENSHOT_SAVE_FAILED" } });

    expect(addToast).toHaveBeenCalledWith("ppo.status.navigationFailed", "error");
  });

  it("logs setup failure and shows fallback toast once", async () => {
    const addToast = vi.fn();
    const error = new Error("bind failed");
    const importEventApi = vi.fn().mockRejectedValue(error);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    startPpoScreenshotEventListener({
      isDesktopShell: true,
      addToast,
      t: (key) => key,
      importEventApi
    });
    startPpoScreenshotEventListener({
      isDesktopShell: true,
      addToast,
      t: (key) => key,
      importEventApi
    });

    await flush();
    await flush();

    expect(consoleError).toHaveBeenCalled();
    expect(addToast).toHaveBeenCalledTimes(1);
    expect(addToast).toHaveBeenCalledWith("ppo.status.navigationFailed", "error");
  });
});
