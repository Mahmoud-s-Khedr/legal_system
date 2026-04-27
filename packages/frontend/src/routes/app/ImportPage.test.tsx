import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const saveTextToDownloadsMock = vi.fn();
const useTableQueryStateMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (args: unknown) => useQueryMock(args)
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock("../../lib/api", () => ({
  apiFetch: vi.fn(),
  apiFormFetch: vi.fn()
}));

vi.mock("../../lib/desktopDownloads", () => ({
  saveTextToDownloads: (...args: unknown[]) => saveTextToDownloadsMock(...args)
}));

vi.mock("../../lib/tableQueryState", () => ({
  useTableQueryState: () => useTableQueryStateMock()
}));

vi.mock("./ui", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  SectionCard: ({ title, children }: { title: string; children: ReactNode }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Field: () => <div data-testid="field" />,
  PrimaryButton: ({ disabled, onClick, children }: { disabled?: boolean; onClick?: () => void; children: ReactNode }) => (
    <button disabled={disabled} onClick={onClick} type="button">
      {children}
    </button>
  ),
  SelectField: () => <div data-testid="select" />,
  TablePagination: () => <div data-testid="pagination" />,
  TableToolbar: () => <div data-testid="toolbar" />
}));

const { ImportPage } = await import("./ImportPage");

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
  vi.clearAllMocks();
  useTableQueryStateMock.mockReturnValue({
    state: { q: "", page: 1, limit: 20, filters: { status: "" } },
    toApiQueryString: () => "page=1&limit=20",
    update: vi.fn()
  });
  useQueryMock.mockReturnValue({
    data: null,
    isLoading: false,
    isError: false,
    error: null
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

describe("ImportPage", () => {
  it("renders upload step and blocks preview until a file is selected", () => {
    const view = render(<ImportPage />);

    expect(view.textContent).toContain("import.title");
    expect(view.textContent).toContain("import.step.upload");

    const buttons = [...view.querySelectorAll("button")];
    const previewButton = buttons.find((button) => button.textContent?.includes("import.preview"));
    expect(previewButton?.getAttribute("disabled")).not.toBeNull();
  });

  it("downloads the selected entity template", () => {
    const view = render(<ImportPage />);

    const casesButton = [...view.querySelectorAll("button")].find(
      (button) => button.textContent === "import.entity.cases"
    );
    expect(casesButton).toBeDefined();

    act(() => {
      casesButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const downloadButton = [...view.querySelectorAll("button")].find(
      (button) => button.textContent === "import.downloadTemplate"
    );

    act(() => {
      downloadButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(saveTextToDownloadsMock).toHaveBeenCalledWith(
      "title,caseNumber,type,status,judicialYear,client_id\n",
      "cases-import-template.csv",
      "text/csv;charset=utf-8"
    );
  });
});
