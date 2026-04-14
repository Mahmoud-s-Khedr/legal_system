import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChanges, useUnsavedChangesBypass } from "./useUnsavedChanges";

const useBlockerMock = vi.hoisted(() => vi.fn());
const confirmActionMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-router", () => ({
  useBlocker: useBlockerMock
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? "Confirm leaving?"
  })
}));

vi.mock("./dialog", () => ({
  confirmAction: confirmActionMock
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Probe({ isDirty, bypassBlockRef }: { isDirty: boolean; bypassBlockRef?: { current: boolean } }) {
  useUnsavedChanges(isDirty, { bypassBlockRef });
  return null;
}

let bypassControls:
  | ReturnType<typeof useUnsavedChangesBypass>
  | null = null;

function BypassProbe() {
  bypassControls = useUnsavedChangesBypass();
  return null;
}

function renderProbe(isDirty: boolean, bypassBlockRef?: { current: boolean }) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<Probe isDirty={isDirty} bypassBlockRef={bypassBlockRef} />);
  });
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  root = null;
  container = null;
  bypassControls = null;
  useBlockerMock.mockReset();
  confirmActionMock.mockReset();
});

describe("useUnsavedChanges", () => {
  it("does not block navigation when confirmation resolves true", async () => {
    confirmActionMock.mockResolvedValueOnce(true);
    renderProbe(true);

    const blockerOptions = useBlockerMock.mock.calls[0]?.[0] as {
      shouldBlockFn: () => Promise<boolean>;
    };

    await expect(blockerOptions.shouldBlockFn()).resolves.toBe(false);
    expect(confirmActionMock).toHaveBeenCalledTimes(1);
  });

  it("blocks navigation when confirmation resolves false", async () => {
    confirmActionMock.mockResolvedValueOnce(false);
    renderProbe(true);

    const blockerOptions = useBlockerMock.mock.calls[0]?.[0] as {
      shouldBlockFn: () => Promise<boolean>;
    };

    await expect(blockerOptions.shouldBlockFn()).resolves.toBe(true);
    expect(confirmActionMock).toHaveBeenCalledTimes(1);
  });

  it("does not block or prompt when form is clean", async () => {
    renderProbe(false);

    const blockerOptions = useBlockerMock.mock.calls[0]?.[0] as {
      shouldBlockFn: () => Promise<boolean>;
    };

    await expect(blockerOptions.shouldBlockFn()).resolves.toBe(false);
    expect(confirmActionMock).not.toHaveBeenCalled();
  });

  it("bypasses blocking exactly once for programmatic navigation", async () => {
    const bypassBlockRef = { current: true };
    renderProbe(true, bypassBlockRef);

    const blockerOptions = useBlockerMock.mock.calls[0]?.[0] as {
      shouldBlockFn: () => Promise<boolean>;
    };

    await expect(blockerOptions.shouldBlockFn()).resolves.toBe(false);
    expect(bypassBlockRef.current).toBe(false);
    expect(confirmActionMock).not.toHaveBeenCalled();
  });

  it("helper sets bypass flag for next navigation", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(<BypassProbe />);
    });

    expect(bypassControls).not.toBeNull();
    expect(bypassControls?.bypassRef.current).toBe(false);
    act(() => {
      bypassControls?.allowNextNavigation();
    });
    expect(bypassControls?.bypassRef.current).toBe(true);
  });

  it("sets beforeunload returnValue when dirty", () => {
    renderProbe(true);

    const event = new Event("beforeunload", { cancelable: true }) as BeforeUnloadEvent;
    Object.defineProperty(event, "returnValue", {
      configurable: true,
      writable: true,
      value: undefined
    });

    window.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
    expect(event.returnValue).toBe("");
  });
});
