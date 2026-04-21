import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../i18n";
import { ApiError } from "../../lib/api";
import { LoginPage } from "./LoginPage";

const navigateMock = vi.fn();
const loginMock = vi.fn();

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
    login: loginMock
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

describe("LoginPage connectivity messaging", () => {
  beforeEach(async () => {
    loginMock.mockReset();
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

  it("shows localized backend connectivity guidance when backend is unreachable", async () => {
    loginMock.mockRejectedValue(
      new ApiError("Unable to reach backend", 503, {
        code: "BACKEND_UNREACHABLE"
      })
    );

    const view = render(<LoginPage />);
    const emailInput = view.querySelector<HTMLInputElement>("#login-email");
    const passwordInput =
      view.querySelector<HTMLInputElement>("#login-password");
    const submitButton = view.querySelector<HTMLButtonElement>(
      "button[type='submit']"
    );

    expect(emailInput).toBeTruthy();
    expect(passwordInput).toBeTruthy();
    expect(submitButton).toBeTruthy();

    await act(async () => {
      emailInput!.value = "tester@example.com";
      emailInput!.dispatchEvent(new Event("input", { bubbles: true }));
      passwordInput!.value = "password";
      passwordInput!.dispatchEvent(new Event("input", { bubbles: true }));
      submitButton!.click();
    });

    expect(view.textContent).toContain(
      "ELMS cannot reach the local backend service."
    );
    expect(view.textContent).toContain("Retry after startup completes.");
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
