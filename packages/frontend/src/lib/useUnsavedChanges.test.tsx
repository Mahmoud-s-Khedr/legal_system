import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useUnsavedChanges } from "./useUnsavedChanges";

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

function Probe({ isDirty }: { isDirty: boolean }) {
  useUnsavedChanges(isDirty);
  return null;
}

function renderProbe(isDirty: boolean) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<Probe isDirty={isDirty} />);
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
  useBlockerMock.mockReset();
  confirmActionMock.mockReset();
});

describe("useUnsavedChanges", () => {
  it("proceeds navigation when confirmation resolves true", async () => {
    confirmActionMock.mockResolvedValueOnce(true);
    renderProbe(true);

    const blockerOptions = useBlockerMock.mock.calls[0]?.[0] as {
      shouldBlockFn: () => Promise<boolean>;
    };

    await expect(blockerOptions.shouldBlockFn()).resolves.toBe(true);
    expect(confirmActionMock).toHaveBeenCalledTimes(1);
  });

  it("cancels navigation when confirmation resolves false", async () => {
    confirmActionMock.mockResolvedValueOnce(false);
    renderProbe(true);

    const blockerOptions = useBlockerMock.mock.calls[0]?.[0] as {
      shouldBlockFn: () => Promise<boolean>;
    };

    await expect(blockerOptions.shouldBlockFn()).resolves.toBe(false);
    expect(confirmActionMock).toHaveBeenCalledTimes(1);
  });
});
