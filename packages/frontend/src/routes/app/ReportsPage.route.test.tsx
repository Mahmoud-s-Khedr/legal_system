import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const queryMock = vi.fn();
const tableUpdateMock = vi.fn();
const tableState = {
  q: "",
  sortBy: "count",
  sortDir: "desc" as const,
  page: 1,
  limit: 20
};

const tableMock = {
  state: tableState,
  toApiQueryString: vi.fn(() => "page=1&limit=20"),
  setQ: vi.fn(),
  setPage: vi.fn(),
  setLimit: vi.fn(),
  update: tableUpdateMock
};

const addToastMock = vi.fn();
const downloadReportFileMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => queryMock(...args)
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: (selector: (state: { addToast: typeof addToastMock }) => unknown) =>
    selector({ addToast: addToastMock })
}));

vi.mock("../../lib/tableQueryState", () => ({
  useTableQueryState: () => tableMock
}));

vi.mock("./reportExport", () => ({
  downloadReportFile: (...args: unknown[]) => downloadReportFileMock(...args)
}));

vi.mock("./ui", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  SectionCard: ({ title, children }: { title: string; children: JSX.Element }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  TableToolbar: ({ children }: { children: JSX.Element }) => <div>{children}</div>,
  TablePagination: () => <div data-testid="pager" />,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  ErrorState: ({
    title,
    onRetry
  }: {
    title: string;
    onRetry: () => void;
  }) => (
    <div>
      <span>{title}</span>
      <button onClick={onRetry} type="button">
        retry
      </button>
    </div>
  ),
  FormAlert: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  Field: ({
    label,
    value,
    onChange,
    type = "text"
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        type={type}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  ),
  SelectField: ({
    label,
    value,
    onChange,
    options
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <label>
      {label}
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  ),
  formatCurrency: (value: unknown) => String(value)
}));

const { ReportsPage } = await import("./ReportsPage");

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

function unmountCurrent() {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  root = null;
  container?.remove();
  container = null;
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  tableMock.toApiQueryString.mockReturnValue("page=1&limit=20");
  queryMock.mockReturnValue({
    isLoading: false,
    isError: false,
    data: { items: [], total: 0 },
    error: null,
    refetch: vi.fn()
  });
});

afterEach(() => {
  unmountCurrent();
});

describe("ReportsPage route behavior", () => {
  it("renders loading, error, and empty states", async () => {
    queryMock.mockReturnValueOnce({
      isLoading: true,
      isError: false,
      data: null,
      error: null,
      refetch: vi.fn()
    });
    const loadingView = render(<ReportsPage />);
    expect(loadingView.textContent).toContain("labels.loading");
    unmountCurrent();

    const refetch = vi.fn();
    queryMock.mockReturnValueOnce({
      isLoading: false,
      isError: true,
      data: null,
      error: new Error("boom"),
      refetch
    });
    const errorView = render(<ReportsPage />);
    const retry = errorView.querySelector("button");
    act(() => {
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();
    expect(refetch).toHaveBeenCalled();
    unmountCurrent();

    queryMock.mockReturnValueOnce({
      isLoading: false,
      isError: false,
      data: { items: [], total: 0 },
      error: null,
      refetch: vi.fn()
    });
    const emptyView = render(<ReportsPage />);
    expect(emptyView.textContent).toContain("reports.noData");
  });

  it("exports report and sends success toast", async () => {
    downloadReportFileMock.mockResolvedValue(undefined);
    queryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [{ status: "ACTIVE", count: 3 }],
        total: 1
      },
      error: null,
      refetch: vi.fn()
    });

    const view = render(<ReportsPage />);
    const exportButton = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "reports.exportExcel"
    );

    act(() => {
      exportButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    await flush();

    expect(downloadReportFileMock).toHaveBeenCalledWith(
      "/api/reports/case-status/export?page=1&limit=20&format=excel",
      "report-case-status.xlsx"
    );
    expect(addToastMock).toHaveBeenCalledWith("reports.exportReady", "success");
  });

  it("changes report type and updates sort defaults", () => {
    queryMock.mockReturnValue({
      isLoading: false,
      isError: false,
      data: {
        items: [{ status: "ACTIVE", month: "2026-04", invoiced: 100, paid: 80 }],
        total: 1
      },
      error: null,
      refetch: vi.fn()
    });

    const view = render(<ReportsPage />);
    const reportTypeSelect = view.querySelector(
      'select[aria-label="reports.reportType"]'
    ) as HTMLSelectElement | null;

    act(() => {
      if (reportTypeSelect) {
        reportTypeSelect.value = "revenue";
        reportTypeSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    expect(tableUpdateMock).toHaveBeenCalledWith(
      expect.objectContaining({
        q: "",
        sortBy: "month",
        sortDir: "asc",
        page: 1
      })
    );
  });
});
