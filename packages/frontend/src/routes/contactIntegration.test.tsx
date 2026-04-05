import { act } from "react";
import type { ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../i18n";
import { router } from "../router";
import { AuthShell } from "./auth/AuthShell";
import { AboutPage } from "./public/AboutPage";

vi.mock("@tanstack/react-router", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => <a href={to} {...props}>{children}</a>
  };
});

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

describe("contact integration smoke", () => {
  beforeEach(async () => {
    vi.stubEnv("VITE_FOOTER_NAME", "Mahmoud Khedr");
    vi.stubEnv("VITE_FOOTER_EMAIL", "mahmoud.s.khedr.2@gmail.com");
    vi.stubEnv("VITE_FOOTER_PHONE", "01016240934");
    vi.stubEnv("VITE_FOOTER_LINKEDIN", "https://www.linkedin.com/in/mahmoud-s-khedr/");
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
    vi.unstubAllEnvs();
  });

  it("builds /about route location without requiring authenticated app routes", () => {
    const location = router.buildLocation({ to: "/about" });
    expect(location.pathname).toBe("/about");
  });

  it("renders developer contact strip in auth shell", () => {
    const view = render(
      <AuthShell title="Auth title" subtitle="Auth subtitle">
        <div>auth body</div>
      </AuthShell>
    );

    expect(view.textContent).toContain("Built by Mahmoud Khedr");
    expect(view.textContent).toContain("Built with care in Egypt");
    expect(view.textContent).toContain("Email");
    expect(view.textContent).toContain("Phone");
    expect(view.textContent).toContain("LinkedIn");
  });

  it("renders about page with contact actions", () => {
    const view = render(<AboutPage />);
    expect(view.textContent).toContain("About This System");
    expect(view.textContent).toContain("Developer Contact");
    expect(view.querySelector("a[href='mailto:mahmoud.s.khedr.2@gmail.com']")).not.toBeNull();
    expect(view.querySelector("a[href='tel:01016240934']")).not.toBeNull();
  });
});
