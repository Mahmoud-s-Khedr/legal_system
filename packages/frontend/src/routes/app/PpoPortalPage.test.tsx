import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PpoPortalLaunchResult, PpoPortalNavResult } from "../../lib/ppoPortal";

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

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  launchPpoPortalMock.mockReset();
  launchPpoPortalMock.mockResolvedValue({ ok: true, destination: "browser-tab", reused: false });
  navigatePpoPortalMock.mockReset();
  navigatePpoPortalMock.mockResolvedValue({ ok: true, action: "back" });
});

afterEach(() => {
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

  it("does not render nav toolbar in non-desktop mode", async () => {
    const view = render(<PpoPortalPage />);

    await act(async () => {
      await Promise.resolve();
    });

    // In non-desktop mode, nav buttons should not be present
    expect(view.textContent).not.toContain("Back");
    expect(view.textContent).not.toContain("Forward");
    expect(view.textContent).not.toContain("Reload");
  });
});

describe("PpoPortalPage (desktop mode)", () => {
  async function renderDesktop() {
    vi.stubEnv("VITE_DESKTOP_SHELL", "true");
    vi.resetModules();

    const { PpoPortalPage: DesktopPage } = await import("./PpoPortalPage");
    const view = render(<DesktopPage />);

    await act(async () => {
      await Promise.resolve();
    });

    return view;
  }

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("renders nav toolbar buttons in desktop mode", async () => {
    const view = await renderDesktop();

    expect(view.querySelector("[data-action='back']")).not.toBeNull();
    expect(view.querySelector("[data-action='forward']")).not.toBeNull();
    expect(view.querySelector("[data-action='reload']")).not.toBeNull();
    expect(view.querySelector("[data-action='home']")).not.toBeNull();
    expect(view.querySelector("[data-action='open_external']")).not.toBeNull();
  });

  it("calls navigatePpoPortal('back') when Back button is clicked", async () => {
    const view = await renderDesktop();

    const backBtn = view.querySelector("[data-action='back']");
    expect(backBtn).not.toBeNull();

    act(() => {
      backBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(navigatePpoPortalMock).toHaveBeenCalledWith("back");
  });

  it("calls navigatePpoPortal('reload') when Reload button is clicked", async () => {
    const view = await renderDesktop();

    const reloadBtn = view.querySelector("[data-action='reload']");
    expect(reloadBtn).not.toBeNull();

    act(() => {
      reloadBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(navigatePpoPortalMock).toHaveBeenCalledWith("reload");
  });

  it("shows window-not-open recovery UI when PPO_WINDOW_NOT_OPEN is returned", async () => {
    navigatePpoPortalMock.mockResolvedValue({ ok: false, code: "PPO_WINDOW_NOT_OPEN" });

    const view = await renderDesktop();

    const backBtn = view.querySelector("[data-action='back']");

    act(() => {
      backBtn?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    await act(async () => {
      await Promise.resolve();
    });

    // Status message for window_not_open should be visible (aria role="status")
    const statusEl = view.querySelector("[role='status']");
    expect(statusEl).not.toBeNull();
    expect(statusEl?.textContent?.length).toBeGreaterThan(0);
  });

  it("fires back navigation on Alt+ArrowLeft keydown", async () => {
    await renderDesktop();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true })
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(navigatePpoPortalMock).toHaveBeenCalledWith("back");
  });

  it("fires forward navigation on Alt+ArrowRight keydown", async () => {
    await renderDesktop();

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true })
      );
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(navigatePpoPortalMock).toHaveBeenCalledWith("forward");
  });
});
