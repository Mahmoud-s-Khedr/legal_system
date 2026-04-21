import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  PpoPortalLaunchResult,
  PpoPortalNavResult
} from "../../lib/ppoPortal";

const { launchPpoPortalMock, navigatePpoPortalMock } = vi.hoisted(() => ({
  launchPpoPortalMock: vi.fn<() => Promise<PpoPortalLaunchResult>>(),
  navigatePpoPortalMock: vi.fn<() => Promise<PpoPortalNavResult>>()
}));

vi.mock("../../lib/ppoPortal", () => ({
  launchPpoPortal: launchPpoPortalMock,
  navigatePpoPortal: navigatePpoPortalMock
}));

import { PpoPortalPage } from "./PpoPortalPage";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  launchPpoPortalMock.mockReset();
  launchPpoPortalMock.mockResolvedValue({
    ok: true,
    destination: "browser-tab",
    reused: false
  });
  navigatePpoPortalMock.mockReset();
  navigatePpoPortalMock.mockResolvedValue({ ok: true, action: "back" });
});

afterEach(() => {
  vi.unstubAllEnvs();

  if (root) {
    act(() => {
      root?.unmount();
    });
  }

  container?.remove();
  root = null;
  container = null;
});

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);

  act(() => {
    root?.render(element);
  });

  return container;
}

describe("PpoPortalPage", () => {
  it("auto-launches PPO once on load and launches again on manual reopen", async () => {
    const view = render(<PpoPortalPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(launchPpoPortalMock).toHaveBeenCalledTimes(1);

    const launchButton = view.querySelector("button");
    expect(launchButton).not.toBeNull();

    act(() => {
      launchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(launchPpoPortalMock).toHaveBeenCalledTimes(2);
  });

  it("renders the macOS unsupported status message when desktop bypass is unavailable", async () => {
    launchPpoPortalMock.mockResolvedValue({
      ok: false,
      code: "PPO_TLS_BYPASS_UNSUPPORTED_MACOS"
    });

    const view = render(<PpoPortalPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(view.textContent).toContain("macOS");
  });

  it("does not render in-page nav buttons", async () => {
    const view = render(<PpoPortalPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(view.querySelector("[data-action='back']")).toBeNull();
    expect(view.querySelector("[data-action='forward']")).toBeNull();
    expect(view.querySelector("[data-action='reload']")).toBeNull();
    expect(view.querySelector("[data-action='home']")).toBeNull();
    expect(view.querySelector("[data-action='open_external']")).toBeNull();
    expect(view.querySelector("[data-action='screenshot']")).toBeNull();
    expect(navigatePpoPortalMock).not.toHaveBeenCalled();
  });

  it("renders screenshot action in desktop mode and triggers screenshot navigation", async () => {
    vi.stubEnv("VITE_DESKTOP_SHELL", "true");
    navigatePpoPortalMock.mockResolvedValue({
      ok: true,
      action: "screenshot",
      url: "/tmp/screenshot.png"
    });

    const view = render(<PpoPortalPage />);

    await act(async () => {
      await Promise.resolve();
    });

    const screenshotButton = view.querySelector("[data-action='screenshot']");
    expect(screenshotButton).not.toBeNull();

    act(() => {
      screenshotButton?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(navigatePpoPortalMock).toHaveBeenCalledWith("screenshot");
  });
});
