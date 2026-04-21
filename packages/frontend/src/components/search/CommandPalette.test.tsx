import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseNavigate = vi.fn();
const mockNavigate = vi.fn();
const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: (...args: unknown[]) => mockUseNavigate(...args)
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args)
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock("../shared/useAccessibleOverlay", () => ({
  useAccessibleOverlay: vi.fn()
}));

const { CommandPalette } = await import("./CommandPalette");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function render(open = true) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<CommandPalette open={open} onClose={vi.fn()} />);
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
  vi.useFakeTimers();
  mockUseNavigate.mockReturnValue(mockNavigate);

  mockUseQuery.mockImplementation((config: { queryKey: string[] }) => {
    if (config.queryKey[0] === "palette-documents") {
      return {
        data: {
          items: [
            {
              id: "doc-1",
              title: "Master Service Agreement",
              type: "CONTRACT",
              headline: "Contains <mark>lease</mark> clause",
              rank: 0.8
            }
          ]
        },
        isFetching: false
      };
    }

    if (config.queryKey[0] === "palette-cases") {
      return {
        data: {
          items: [{ id: "case-1", title: "Lease Dispute" }]
        },
        isFetching: false
      };
    }

    if (config.queryKey[0] === "palette-clients") {
      return {
        data: {
          items: [{ id: "client-1", name: "Mahmoud" }]
        },
        isFetching: false
      };
    }

    return { data: { items: [] }, isFetching: false };
  });
});

afterEach(() => {
  vi.useRealTimers();
});

describe("CommandPalette", () => {
  it("renders mixed document/entity results after typing a query", () => {
    const view = render(true);

    const input = view.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement;

    act(() => {
      setTextInputValue(input, "lease");
    });

    act(() => {
      vi.advanceTimersByTime(250);
    });

    expect(view.textContent).toContain("Master Service Agreement");
    expect(view.textContent).toContain("Lease Dispute");
    expect(view.textContent).toContain("Mahmoud");
  });

  it("enables document query only after non-empty debounced input", () => {
    const view = render(true);

    const initialDocCall = mockUseQuery.mock.calls.find(
      (call) => call[0]?.queryKey?.[0] === "palette-documents"
    )?.[0] as { enabled?: boolean };
    expect(initialDocCall.enabled).toBe(false);

    const input = view.querySelector(
      'input[type="search"]'
    ) as HTMLInputElement;

    act(() => {
      setTextInputValue(input, "contract");
      vi.advanceTimersByTime(250);
    });

    const enabledDocCalls = mockUseQuery.mock.calls
      .filter((call) => call[0]?.queryKey?.[0] === "palette-documents")
      .map((call) => call[0] as { enabled?: boolean });

    expect(enabledDocCalls.some((call) => call.enabled === true)).toBe(true);
  });
});
