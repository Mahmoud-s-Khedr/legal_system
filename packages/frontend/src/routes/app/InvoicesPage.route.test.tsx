import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InvoiceStatus } from "@elms/shared";

const useInvoicesMock = vi.fn();
const mutationMutateMock = vi.fn();
const refetchMock = vi.fn();
const invalidateQueriesMock = vi.fn();

const tableState = {
  q: "",
  sortBy: "createdAt",
  sortDir: "desc" as const,
  page: 1,
  limit: 20,
  filters: { status: "" }
};

const tableMock = {
  state: tableState,
  setQ: vi.fn(),
  setPage: vi.fn(),
  setLimit: vi.fn(),
  setSort: vi.fn(),
  setFilter: vi.fn()
};

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to
  }: {
    children: JSX.Element | string;
    to: string;
  }) => <a href={to}>{children}</a>
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
  useMutation: () => ({
    mutate: mutationMutateMock,
    isPending: false
  })
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock("../../lib/billing", () => ({
  useInvoices: (...args: unknown[]) => useInvoicesMock(...args)
}));

vi.mock("../../lib/tableQueryState", () => ({
  useTableQueryState: () => tableMock
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
  Field: ({
    label,
    value,
    onChange
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
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
  DataTable: ({ children }: { children: JSX.Element }) => <table>{children}</table>,
  TableHead: ({ children }: { children: JSX.Element }) => <thead>{children}</thead>,
  TableHeadCell: ({ children }: { children: JSX.Element | string }) => (
    <th>{children}</th>
  ),
  SortableTableHeadCell: ({ label }: { label: string }) => <th>{label}</th>,
  TableBody: ({ children }: { children: JSX.Element }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: JSX.Element }) => <tr>{children}</tr>,
  TableCell: ({ children }: { children: JSX.Element | string }) => <td>{children}</td>,
  TableWrapper: ({ children }: { children: JSX.Element }) => <div>{children}</div>,
  TablePagination: () => <div data-testid="pager" />,
  ResponsiveDataList: ({
    items,
    actions
  }: {
    items: Array<{
      id: string;
      invoiceNumber: string;
      status: InvoiceStatus;
      totalAmount: string;
      clientName?: string | null;
      caseTitle?: string | null;
    }>;
    actions: (item: {
      id: string;
      invoiceNumber: string;
      status: InvoiceStatus;
      totalAmount: string;
      clientName?: string | null;
      caseTitle?: string | null;
    }) => JSX.Element;
  }) => (
    <div>
      {items.map((item) => (
        <article key={item.id}>
          <div>{item.invoiceNumber}</div>
          {actions(item)}
        </article>
      ))}
    </div>
  ),
  formatCurrency: (value: unknown) => String(value)
}));

const { InvoicesPage } = await import("./InvoicesPage");

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

beforeEach(() => {
  vi.clearAllMocks();
  useInvoicesMock.mockReturnValue({
    data: { items: [], total: 0 },
    isLoading: false,
    isError: false,
    error: null,
    refetch: refetchMock
  });
});

afterEach(() => {
  unmountCurrent();
});

describe("InvoicesPage route behavior", () => {
  it("renders loading, error, and empty states", () => {
    useInvoicesMock.mockReturnValueOnce({
      data: null,
      isLoading: true,
      isError: false,
      error: null,
      refetch: refetchMock
    });
    const loadingView = render(<InvoicesPage />);
    expect(loadingView.textContent).toContain("labels.loading");
    unmountCurrent();

    useInvoicesMock.mockReturnValueOnce({
      data: null,
      isLoading: false,
      isError: true,
      error: new Error("nope"),
      refetch: refetchMock
    });
    const errorView = render(<InvoicesPage />);
    const retry = errorView.querySelector("button");
    act(() => {
      retry?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(refetchMock).toHaveBeenCalled();
    unmountCurrent();

    useInvoicesMock.mockReturnValueOnce({
      data: { items: [], total: 0 },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchMock
    });
    const emptyView = render(<InvoicesPage />);
    expect(emptyView.textContent).toContain("empty.noInvoices");
  });

  it("opens payment form and submits payment mutation with remaining amount", () => {
    useInvoicesMock.mockReturnValue({
      data: {
        items: [
          {
            id: "inv-1",
            invoiceNumber: "INV-001",
            status: InvoiceStatus.ISSUED,
            totalAmount: "100",
            payments: [{ amount: "30" }],
            clientName: "Client A",
            caseTitle: null
          }
        ],
        total: 1
      },
      isLoading: false,
      isError: false,
      error: null,
      refetch: refetchMock
    });

    const view = render(<InvoicesPage />);
    const recordButtons = Array.from(view.querySelectorAll("button")).filter(
      (button) => button.textContent === "billing.recordPayment"
    );
    expect(recordButtons.length).toBeGreaterThan(0);

    act(() => {
      recordButtons[0]?.dispatchEvent(
        new MouseEvent("click", { bubbles: true })
      );
    });

    const form = view.querySelector("form");
    expect(form).not.toBeNull();

    act(() => {
      form?.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
    });

    expect(mutationMutateMock).toHaveBeenCalledWith({
      invoiceId: "inv-1",
      dto: {
        amount: "70.00",
        method: "CASH",
        referenceNumber: null
      }
    });
  });
});
