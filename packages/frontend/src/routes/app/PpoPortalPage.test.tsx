import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PpoPortalLaunchResult } from "../../lib/ppoPortal";

const { launchPpoPortalMock } = vi.hoisted(() => ({
  launchPpoPortalMock: vi.fn<() => Promise<PpoPortalLaunchResult>>()
}));

vi.mock("../../lib/ppoPortal", () => ({
  launchPpoPortal: launchPpoPortalMock
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

  it("renders a popup-blocked status message when the browser blocks the tab", async () => {
    launchPpoPortalMock.mockResolvedValue({
      ok: false,
      code: "PPO_WEB_POPUP_BLOCKED",
      message: "Could not open the PPO tab. Please allow pop-ups for this site and try again."
    });

    const view = render(<PpoPortalPage />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(view.textContent).toContain("Could not open the PPO tab");
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
  });
});
