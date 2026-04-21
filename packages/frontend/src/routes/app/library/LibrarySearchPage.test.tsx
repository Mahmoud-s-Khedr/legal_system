import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args)
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, args?: Record<string, unknown>) =>
      key === "library.resultsCount" ? `${args?.count ?? 0}` : key
  })
}));

vi.mock("antd", () => ({
  Select: ({
    value,
    onChange,
    options
  }: {
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}));

vi.mock("../ui", () => ({
  PageHeader: () => <div />,
  EmptyState: () => <div />,
  ErrorState: () => <div />,
  selectLabelFilter: () => true
}));

const { LibrarySearchPage } = await import("./LibrarySearchPage");

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
    root?.render(<LibrarySearchPage />);
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
  mockUseQuery.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { results: [] },
    refetch: vi.fn()
  });
});

describe("LibrarySearchPage", () => {
  it("enables query for one-character submitted input", () => {
    const view = render();
    const input = view.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement;
    const form = view.querySelector("form");

    act(() => {
      setTextInputValue(input, "a");
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const searchCalls = mockUseQuery.mock.calls.map(
      (call) => call[0] as { enabled?: boolean; queryKey?: string[] }
    );

    expect(
      searchCalls.some(
        (call) =>
          call.enabled === true &&
          call.queryKey?.[0] === "library-search" &&
          call.queryKey?.[1] === "a"
      )
    ).toBe(true);
  });

  it("does not enable query for whitespace-only input", () => {
    const view = render();
    const input = view.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement;
    const form = view.querySelector("form");

    act(() => {
      setTextInputValue(input, "   ");
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    const lastCall = mockUseQuery.mock.calls.at(-1)?.[0] as {
      enabled?: boolean;
    };
    expect(lastCall.enabled).toBe(false);
  });
});
