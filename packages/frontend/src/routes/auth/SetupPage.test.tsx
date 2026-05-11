import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { ApiError } from "../../lib/api";
import { SetupPage } from "./SetupPage";

const navigateMock = vi.fn();
const setupMock = vi.fn();

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>(
    "@tanstack/react-router"
  );
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
    useNavigate: () => navigateMock
  };
});

vi.mock("../../store/authStore", () => ({
  useAuthBootstrap: () => ({
    setup: setupMock
  })
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

describe("SetupPage validation messaging", () => {
  beforeEach(async () => {
    setupMock.mockReset();
    navigateMock.mockReset();
    await act(async () => {
      await i18n.changeLanguage("en");
    });
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

  it("shows summary and inline field validation errors from API payload", async () => {
    setupMock.mockRejectedValue(
      new ApiError("Please review the highlighted fields and try again.", 400, {
        code: "VALIDATION_ERROR",
        message: "Please review the highlighted fields and try again.",
        issues: [
          {
            path: "email",
            code: "invalid_format",
            message: "Enter a valid email address.",
            messageKey: "VALIDATION_INVALID_EMAIL",
            params: { format: "email" }
          }
        ]
      })
    );

    const view = render(<SetupPage />);
    const emailInput = view.querySelector<HTMLInputElement>("#setup-email");
    const passwordInput = view.querySelector<HTMLInputElement>("#setup-password");
    const submitButton = view.querySelector<HTMLButtonElement>("button[type='submit']");
    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();

    await act(async () => {
      emailInput!.value = "tester@example.com";
      emailInput!.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput!.value = "password123";
      passwordInput!.dispatchEvent(new Event("input", { bubbles: true }));
      submitButton!.click();
    });

    expect(view.textContent).toContain("Please review the highlighted fields and try again.");
    expect(view.textContent).toContain("Enter a valid email address.");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
