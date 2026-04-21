import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSearch = vi.fn();
const mockNavigate = vi.fn();
const mockUseNavigate = vi.fn(() => mockNavigate);
const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useSearch: mockUseSearch,
  useNavigate: mockUseNavigate
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mockUseQuery
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock("./ui", () => ({
  PageHeader: ({ title }: { title: string }) => (
    <div data-testid="header">{title}</div>
  ),
  EmptyState: ({
    title,
    description
  }: {
    title: string;
    description: string;
  }) => (
    <div data-testid="empty">
      {title}:{description}
    </div>
  ),
  ErrorState: ({ title }: { title: string }) => (
    <div data-testid="error">{title}</div>
  )
}));

vi.mock("../../components/search/SearchResultCard", () => ({
  SearchResultCard: ({ result }: { result: { id: string; title: string } }) => (
    <div data-testid={`result-${result.id}`}>{result.title}</div>
  )
}));

const { SearchPage } = await import("./SearchPage");

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
    root?.render(<SearchPage />);
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
  mockUseNavigate.mockReturnValue(mockNavigate);
  mockUseSearch.mockReturnValue({ q: "" });
  mockUseQuery.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { items: [], total: 0 },
    refetch: vi.fn()
  });
});

describe("SearchPage", () => {
  it("prefills the search input from URL query", () => {
    mockUseSearch.mockReturnValue({ q: "alpha" });

    const view = render();
    const input = view.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement | null;

    expect(input?.value).toBe("alpha");
  });

  it("updates URL query on submit", () => {
    const view = render();

    const form = view.querySelector("form");
    const input = view.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement;

    act(() => {
      setTextInputValue(input, "lease");
    });

    act(() => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/app/search",
      search: { q: "lease" }
    });
  });

  it("disables query execution for empty URL query", () => {
    mockUseSearch.mockReturnValue({ q: "   " });

    render();

    const firstCall = mockUseQuery.mock.calls[0]?.[0] as { enabled?: boolean };
    expect(firstCall.enabled).toBe(false);
  });

  it("enables query execution for one-character URL query", () => {
    mockUseSearch.mockReturnValue({ q: "a" });

    render();

    const firstCall = mockUseQuery.mock.calls[0]?.[0] as { enabled?: boolean };
    expect(firstCall.enabled).toBe(true);
  });
});
