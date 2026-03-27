import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { Field, FormAlert } from "./ui";

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

describe("shared ui fields", () => {
  it("associates input with explicit label and error metadata", () => {
    const view = render(
      <Field
        id="client-email"
        label="Email"
        value=""
        onChange={() => undefined}
        error="Invalid email"
        hint="Use your work email"
      />
    );

    const input = view.querySelector("input#client-email");
    const label = view.querySelector("label[for='client-email']");
    const error = view.querySelector("#client-email-error");
    const hint = view.querySelector("#client-email-hint");

    expect(label?.textContent).toContain("Email");
    expect(input?.getAttribute("aria-invalid")).toBe("true");
    expect(input?.getAttribute("aria-describedby")).toContain("client-email-hint");
    expect(input?.getAttribute("aria-describedby")).toContain("client-email-error");
    expect(error?.textContent).toBe("Invalid email");
    expect(hint?.textContent).toBe("Use your work email");
  });

  it("renders form alert with polite live region", () => {
    const view = render(<FormAlert message="Login failed" />);
    const alert = view.querySelector("[role='status']");

    expect(alert?.getAttribute("aria-live")).toBe("polite");
    expect(alert?.textContent).toContain("Login failed");
  });
});
