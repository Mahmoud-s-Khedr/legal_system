import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FormExitActions } from "./ui";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children: any }) => (
    <a href={to} {...props}>{children}</a>
  )
}));

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

function renderElement(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });

  return container;
}

describe("FormExitActions", () => {
  it("renders cancel and submit actions", () => {
    const view = renderElement(
      <FormExitActions
        cancelTo="/app/cases"
        cancelLabel="Cancel"
        submitLabel="Save"
      />
    );

    const cancel = view.querySelector("a[href='/app/cases']");
    const submit = view.querySelector("button[type='submit']");
    expect(cancel?.textContent).toContain("Cancel");
    expect(submit?.textContent).toContain("Save");
  });

  it("renders optional save-and-exit action", () => {
    const view = renderElement(
      <FormExitActions
        cancelTo="/app/cases"
        cancelLabel="Cancel"
        submitLabel="Save"
        saveAndExitLabel="Save & Exit"
        onSaveAndExit={() => undefined}
      />
    );

    const saveAndExit = Array.from(view.querySelectorAll("button")).find((button) => button.textContent?.includes("Save & Exit"));
    expect(saveAndExit).toBeDefined();
  });
});
