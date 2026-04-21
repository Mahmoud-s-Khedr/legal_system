import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseQueryClient = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args),
  useQueryClient: () => mockUseQueryClient()
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children
  }: {
    children: ReactNode;
  }) => <a>{children}</a>
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key })
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => vi.fn()
}));

vi.mock("../../routes/app/ui", () => ({
  SectionCard: ({
    children
  }: {
    children: ReactNode;
  }) => <div>{children}</div>,
  EmptyState: () => <div />,
  ErrorState: () => <div />,
  PrimaryButton: ({
    children,
    onClick
  }: {
    children: ReactNode;
    onClick: () => void;
  }) => <button onClick={onClick}>{children}</button>
}));

const { CaseLegalReferencesTab } = await import("./CaseLegalReferencesTab");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<CaseLegalReferencesTab caseId="case-1" />);
  });
  return container;
}

function setTextInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container?.remove();
  container = null;
});

beforeEach(() => {
  vi.clearAllMocks();
  mockUseQueryClient.mockReturnValue({
    invalidateQueries: vi.fn()
  });
  mockUseMutation.mockReturnValue({
    mutate: vi.fn(),
    isPending: false
  });
  mockUseQuery.mockImplementation((config: { queryKey: string[] }) => {
    if (config.queryKey[0] === "case-legal-refs") {
      return {
        isLoading: false,
        isError: false,
        data: []
      };
    }
    if (config.queryKey[0] === "library-search-link") {
      return {
        isLoading: false,
        isError: false,
        data: { results: [] }
      };
    }
    return {
      isLoading: false,
      isError: false,
      data: undefined
    };
  });
});

describe("CaseLegalReferencesTab", () => {
  it("enables library search query for one-character input", () => {
    const view = render();

    const openSearchButton = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("library.addReference")
    );
    expect(openSearchButton).toBeTruthy();

    act(() => {
      openSearchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const searchInput = view.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement;

    act(() => {
      setTextInputValue(searchInput, "a");
    });

    const searchCalls = mockUseQuery.mock.calls
      .map((call) => call[0] as { queryKey?: string[]; enabled?: boolean })
      .filter((call) => call.queryKey?.[0] === "library-search-link");

    expect(
      searchCalls.some(
        (call) => call.enabled === true && call.queryKey?.[1] === "a"
      )
    ).toBe(true);
  });
});
