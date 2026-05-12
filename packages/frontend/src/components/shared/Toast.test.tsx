import { afterEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react";
import { ToastContainer } from "./Toast";

const removeToast = vi.fn();

vi.mock("../../store/toastStore", () => ({
  useToastStore: (
    selector: (state: {
      toasts: Array<{
        id: string;
        message: string;
        variant: "success" | "error" | "info";
        exiting?: boolean;
      }>;
      removeToast: typeof removeToast;
    }) => unknown
  ) =>
    selector({
      toasts: [{ id: "toast-1", message: "Saved", variant: "success" }],
      removeToast
    })
}));

describe("ToastContainer", () => {
  let container: HTMLDivElement;
  let root: Root;

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    removeToast.mockReset();
  });

  it("keeps overlay non-interactive while toast card stays interactive", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);

    act(() => {
      root.render(<ToastContainer />);
    });

    const wrapper = container.querySelector("div[aria-atomic='false']");
    const card = container.querySelector("div[role='status']");

    expect(wrapper?.className).toContain("pointer-events-none");
    expect(card?.className).toContain("pointer-events-auto");
  });
});
