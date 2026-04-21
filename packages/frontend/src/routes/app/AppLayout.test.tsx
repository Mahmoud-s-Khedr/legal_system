import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const logoutMock = vi.fn(async () => undefined);
const useAuthBootstrapMock = vi.fn(() => ({
  user: { fullName: "Amina H.", permissions: ["cases:read"] },
  logout: logoutMock
}));

const commandPaletteStates: boolean[] = [];

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, className }: { children: unknown; to: string; className?: string }) => (
    <a href={to} className={className}>
      {children}
    </a>
  ),
  Outlet: () => <div data-testid="outlet" />,
  useMatches: () => [{ pathname: "/app/dashboard" }, { pathname: "/app/cases" }]
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en", language: "en" }
  })
}));

vi.mock("../../store/authStore", () => ({
  useAuthBootstrap: () => useAuthBootstrapMock()
}));

vi.mock("../../components/shared/LanguageSwitcher", () => ({
  LanguageSwitcher: () => <div data-testid="lang-switcher" />
}));

vi.mock("../../components/search/GlobalSearchBar", () => ({
  GlobalSearchBar: ({ onOpenPalette }: { onOpenPalette: () => void }) => (
    <button onClick={onOpenPalette} type="button">
      search
    </button>
  )
}));

vi.mock("../../components/search/CommandPalette", () => ({
  CommandPalette: ({ open }: { open: boolean }) => {
    commandPaletteStates.push(open);
    return <div data-testid="command-palette">{open ? "open" : "closed"}</div>;
  }
}));

vi.mock("../../components/notifications/NotificationBell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />
}));

vi.mock("../../components/shared/useAccessibleOverlay", () => ({
  useAccessibleOverlay: vi.fn()
}));

vi.mock("./breadcrumbs", () => ({
  buildAppBreadcrumbItems: () => [
    { label: "dashboard", to: "/app/dashboard" },
    { label: "cases" }
  ]
}));

vi.mock("./SidebarNav", () => ({
  SidebarNav: () => <nav data-testid="sidebar-nav" />
}));

vi.mock("./navConfig", () => ({
  buildSidebarNavSections: () => [{ label: "Cases", items: [{ label: "All" }] }]
}));

vi.mock("../../components/navigation/BackToTopButton", () => ({
  BackToTopButton: () => <button type="button">top</button>
}));

vi.mock("../../components/navigation/ShellFooter", () => ({
  ShellFooter: ({ links }: { links: unknown[] }) => (
    <footer data-testid="shell-footer">{links.length}</footer>
  )
}));

vi.mock("../../components/navigation/shellFooterLinks", () => ({
  buildAppShellFooterLinks: () => [{ label: "help", href: "/help" }]
}));

const { AppLayout } = await import("./AppLayout");

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

beforeEach(() => {
  commandPaletteStates.length = 0;
  logoutMock.mockReset();
  useAuthBootstrapMock.mockReturnValue({
    user: { fullName: "Amina Hassan", permissions: ["cases:read"] },
    logout: logoutMock
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

describe("AppLayout", () => {
  it("renders shell, breadcrumbs, and user initials", () => {
    const view = render(<AppLayout />);

    expect(view.textContent).toContain("actions.skipToContent");
    expect(view.textContent).toContain("dashboard");
    expect(view.textContent).toContain("cases");
    expect(view.textContent).toContain("ELMS");
    expect(view.textContent).toContain("AH");
    expect(view.querySelector("[data-testid='sidebar-nav']")).not.toBeNull();
    expect(view.querySelector("[data-testid='shell-footer']")?.textContent).toBe("1");
  });

  it("toggles command palette with Ctrl+K", () => {
    render(<AppLayout />);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });

    expect(commandPaletteStates).toContain(true);
  });

  it("calls logout from header action", () => {
    const view = render(<AppLayout />);
    const logoutButtons = view.querySelectorAll("button[aria-label='actions.logout']");
    expect(logoutButtons.length).toBeGreaterThan(0);

    act(() => {
      logoutButtons[0]?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(logoutMock).toHaveBeenCalled();
  });
});
