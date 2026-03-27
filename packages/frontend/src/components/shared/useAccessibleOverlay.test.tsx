import { useRef, useState } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { useAccessibleOverlay } from "./useAccessibleOverlay";

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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

function TestOverlay() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useAccessibleOverlay({
    open,
    mode: "modal",
    contentRef,
    triggerRef,
    onClose: () => setOpen(false)
  });

  return (
    <div>
      <button id="open-btn" ref={triggerRef} onClick={() => setOpen(true)} type="button">
        Open
      </button>
      {open ? (
        <div id="overlay-panel" ref={contentRef} tabIndex={-1}>
          <button id="first" type="button">First</button>
          <button id="last" type="button">Last</button>
        </div>
      ) : null}
    </div>
  );
}

describe("useAccessibleOverlay", () => {
  it("closes on Escape and restores focus to trigger", () => {
    const view = render(<TestOverlay />);
    const openButton = view.querySelector<HTMLButtonElement>("#open-btn");
    expect(openButton).toBeTruthy();

    act(() => {
      openButton?.click();
    });
    expect(view.querySelector("#overlay-panel")).toBeTruthy();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(view.querySelector("#overlay-panel")).toBeFalsy();
    expect(document.activeElement).toBe(openButton);
  });

  it("traps focus on Tab within overlay content", () => {
    const view = render(<TestOverlay />);
    const openButton = view.querySelector<HTMLButtonElement>("#open-btn");

    act(() => {
      openButton?.click();
    });

    const first = view.querySelector<HTMLButtonElement>("#first");
    const last = view.querySelector<HTMLButtonElement>("#last");
    last?.focus();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
    });

    expect(document.activeElement).toBe(first);
  });
});
