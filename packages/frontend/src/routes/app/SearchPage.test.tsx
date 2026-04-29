import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseSearch = vi.fn();
const mockNavigate = vi.fn();
const mockUseNavigate = vi.fn(() => mockNavigate);
const mockUseQuery = vi.fn();
const mockTablePagination = vi.fn();

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
  ),
  TablePagination: (props: unknown) => mockTablePagination(props)
}));

vi.mock("../../components/search/GlobalSearchResultCard", () => ({
  GlobalSearchResultCard: ({ result }: { result: { id: string; title: string } }) => (
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
  mockUseSearch.mockReturnValue({ q: "", page: 1, pageSize: 20 });
  mockUseQuery.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { items: [], total: 0, page: 1, pageSize: 20 },
    refetch: vi.fn()
  });
  mockTablePagination.mockImplementation(() => <div data-testid="pagination" />);
});

describe("SearchPage", () => {
  it("prefills the search input from URL query", () => {
    mockUseSearch.mockReturnValue({ q: "alpha", page: 1, pageSize: 20 });

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
      search: { q: "lease", page: 1, pageSize: 20 }
    });
  });

  it("disables query execution for empty URL query", () => {
    mockUseSearch.mockReturnValue({ q: "   ", page: 1, pageSize: 20 });

    render();

    const firstCall = mockUseQuery.mock.calls[0]?.[0] as { enabled?: boolean };
    expect(firstCall.enabled).toBe(false);
  });

  it("enables query execution for one-character URL query", () => {
    mockUseSearch.mockReturnValue({ q: "a", page: 1, pageSize: 20 });

    render();

    const firstCall = mockUseQuery.mock.calls[0]?.[0] as { enabled?: boolean };
    expect(firstCall.enabled).toBe(true);
  });

  it("includes page and pageSize in the search query key", () => {
    mockUseSearch.mockReturnValue({ q: "alpha", page: 3, pageSize: 50 });

    render();

    const firstCall = mockUseQuery.mock.calls[0]?.[0] as {
      queryKey?: Array<string | number>;
    };

    expect(firstCall.queryKey).toEqual(["global-search", "alpha", 3, 50]);
  });

  it("passes pagination state and navigates when the pager changes", () => {
    mockUseSearch.mockReturnValue({ q: "alpha", page: 2, pageSize: 10 });
    mockUseQuery.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [
          {
            entityType: "document",
            id: "doc-1",
            title: "Alpha",
            snippet: null,
            url: "/app/documents/doc-1",
            rank: 10
          }
        ],
        total: 25,
        page: 2,
        pageSize: 10
      },
      refetch: vi.fn()
    });
    mockTablePagination.mockImplementation((props: {
      page: number;
      pageSize: number;
      total: number;
      onPageChange: (page: number) => void;
      onPageSizeChange: (pageSize: number) => void;
    }) => (
      <div data-testid="pagination">
        <span data-testid="pagination-page">{props.page}</span>
        <span data-testid="pagination-size">{props.pageSize}</span>
        <span data-testid="pagination-total">{props.total}</span>
        <button
          type="button"
          data-testid="pagination-next"
          onClick={() => props.onPageChange(props.page + 1)}
        >
          next
        </button>
        <button
          type="button"
          data-testid="pagination-size-change"
          onClick={() => props.onPageSizeChange(20)}
        >
          size
        </button>
      </div>
    ));

    const view = render();

    expect(view.querySelector('[data-testid="pagination-page"]')?.textContent).toBe("2");
    expect(view.querySelector('[data-testid="pagination-size"]')?.textContent).toBe("10");
    expect(view.querySelector('[data-testid="pagination-total"]')?.textContent).toBe("25");

    const nextButton = view.querySelector(
      '[data-testid="pagination-next"]'
    ) as HTMLButtonElement | null;
    const sizeButton = view.querySelector(
      '[data-testid="pagination-size-change"]'
    ) as HTMLButtonElement | null;

    act(() => {
      nextButton?.click();
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/app/search",
      search: { q: "alpha", page: 3, pageSize: 10 }
    });

    act(() => {
      sizeButton?.click();
    });

    expect(mockNavigate).toHaveBeenCalledWith({
      to: "/app/search",
      search: { q: "alpha", page: 1, pageSize: 20 }
    });
  });
});
