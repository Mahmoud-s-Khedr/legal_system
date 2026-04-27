import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseParams = vi.fn();
const mockUseNavigate = vi.fn(() => vi.fn());
const mockUseQuery = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useParams: mockUseParams,
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

vi.mock("../../components/documents/DocumentViewer", () => ({
  DocumentViewer: ({ document }: { document: { title: string } }) => (
    <div data-testid="document-viewer">{document.title}</div>
  )
}));

vi.mock("./ui", () => ({
  ErrorState: ({ title }: { title: string }) => <div>{title}</div>
}));

const { DocumentDetailPage } = await import("./DocumentDetailPage");

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
    root?.render(<DocumentDetailPage />);
  });
  return container;
}

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

beforeEach(() => {
  vi.clearAllMocks();
  mockUseParams.mockReturnValue({ documentId: "doc-1" });
  mockUseQuery.mockReturnValue({
    isLoading: false,
    isError: false,
    data: {
      id: "doc-1",
      title: "Search Result Document"
    },
    refetch: vi.fn()
  });
});

describe("DocumentDetailPage", () => {
  it("renders the document fetched for the route id", () => {
    const view = render();

    expect(view.querySelector('[data-testid="document-viewer"]')?.textContent).toBe(
      "Search Result Document"
    );
  });
});