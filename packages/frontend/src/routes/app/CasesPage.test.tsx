import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockUseQuery = vi.fn();
const mockUseTableQueryState = vi.fn();
const mockUseLocalizedLookupOptions = vi.fn();
const mockUseAuthBootstrap = vi.fn();
const mockApiFetch = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => mockUseQuery(...args)
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to
  }: {
    children: JSX.Element | string;
    to: string;
  }) => <a href={to}>{children}</a>
}));

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof import("react-i18next")>("react-i18next");
  return {
    ...actual,
  useTranslation: () => ({
    t: (key: string) => key
  })

  };
});

vi.mock("../../lib/api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args)
}));

vi.mock("../../lib/tableQueryState", () => ({
  useTableQueryState: () => mockUseTableQueryState()
}));

vi.mock("../../lib/lookups", () => ({
  useLocalizedLookupOptions: (...args: unknown[]) =>
    mockUseLocalizedLookupOptions(...args)
}));

vi.mock("../../store/authStore", () => ({
  useAuthBootstrap: () => mockUseAuthBootstrap()
}));

vi.mock("../../lib/enumLabel", () => ({
  getEnumLabel: (_t: unknown, _enumName: string, value: string) => value
}));

vi.mock("./ui", () => ({
  DataTable: ({ children }: { children: JSX.Element }) => <table>{children}</table>,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  ErrorState: ({ title }: { title: string }) => <div>{title}</div>,
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
      <input aria-label={label} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  ),
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  ResponsiveDataList: ({
    items,
    fields,
    actions
  }: {
    items: Array<{ id: string }>;
    fields: Array<{ key: string; label: string; render: (item: never) => JSX.Element | string }>;
    actions: (item: never) => JSX.Element;
  }) => (
    <div>
      {items.map((item) => (
        <article key={item.id}>
          {fields.map((field) => (
            <div key={field.key}>
              <span>{field.label}</span>
              <span>{field.render(item as never)}</span>
            </div>
          ))}
          {actions(item as never)}
        </article>
      ))}
    </div>
  ),
  SectionCard: ({ children }: { children: JSX.Element }) => <section>{children}</section>,
  SelectField: ({
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
      <select aria-label={label} value={value} onChange={(event) => onChange(event.currentTarget.value)} />
    </label>
  ),
  SortableTableHeadCell: ({ label }: { label: string }) => <th>{label}</th>,
  TableBody: ({ children }: { children: JSX.Element }) => <tbody>{children}</tbody>,
  TableCell: ({ children }: { children: JSX.Element | string }) => <td>{children}</td>,
  TableHead: ({ children }: { children: JSX.Element }) => <thead>{children}</thead>,
  TableHeadCell: ({ children }: { children: JSX.Element | string }) => <th>{children}</th>,
  TablePagination: () => <div data-testid="pager" />,
  TableRow: ({ children }: { children: JSX.Element }) => <tr>{children}</tr>,
  TableToolbar: ({ children }: { children: JSX.Element }) => <div>{children}</div>,
  TableWrapper: ({ children }: { children: JSX.Element }) => <div>{children}</div>
}));

const { CasesPage } = await import("./CasesPage");

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
    root?.render(<CasesPage />);
  });
  return container;
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
  mockApiFetch.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20 });
  mockUseTableQueryState.mockReturnValue({
    state: {
      q: "",
      sortBy: "updatedAt",
      sortDir: "desc",
      page: 1,
      limit: 20,
      filters: {
        status: "",
        type: "",
        assignedLawyerId: "",
        createdFrom: "",
        createdTo: ""
      }
    },
    setQ: vi.fn(),
    setPage: vi.fn(),
    setLimit: vi.fn(),
    setSort: vi.fn(),
    setFilter: vi.fn(),
    toApiQueryString: () => ""
  });
  mockUseLocalizedLookupOptions.mockReturnValue({
    data: { items: [] },
    options: [],
    getLabel: (key: string) => key
  });
  mockUseAuthBootstrap.mockReturnValue({
    user: { id: "user-1", permissions: ["cases:read", "users:read"] }
  });
  mockUseQuery.mockImplementation(
    ({ queryFn, enabled = true }: { queryFn: () => unknown; enabled?: boolean }) => {
      if (enabled) {
        void queryFn();
      }
      return {
        isLoading: false,
        isError: false,
        data: {
          items: [
            {
              id: "case-1",
              title: "Lease dispute",
              caseNumber: "12/2026",
              internalRef: "S-100",
              judicialYear: 2026,
              status: "OPEN"
            }
          ],
          total: 1
        },
        error: null,
        refetch: vi.fn()
      };
    }
  );
});

describe("CasesPage", () => {
  it("renders serial and judicial year columns", () => {
    const view = render();

    expect(view.textContent).toContain("labels.internalRef");
    expect(view.textContent).toContain("labels.judicialYear");
    expect(view.textContent).toContain("S-100");
    expect(view.textContent).toContain("2026");
  });

  it("sends canonical createdFrom/createdTo and drops malformed date filters", () => {
    mockUseTableQueryState.mockReturnValueOnce({
      state: {
        q: "",
        sortBy: "updatedAt",
        sortDir: "desc",
        page: 1,
        limit: 20,
        filters: {
          status: "",
          type: "",
          assignedLawyerId: "",
          createdFrom: "2026-05-03",
          createdTo: "2026-13-99"
        }
      },
      setQ: vi.fn(),
      setPage: vi.fn(),
      setLimit: vi.fn(),
      setSort: vi.fn(),
      setFilter: vi.fn(),
      toApiQueryString: () => "page=1&limit=20"
    });

    render();

    const caseRequest = mockApiFetch.mock.calls.find(
      (call) => typeof call[0] === "string" && String(call[0]).startsWith("/api/cases?")
    )?.[0];
    expect(typeof caseRequest).toBe("string");
    expect(String(caseRequest)).toContain("createdFrom=2026-05-03");
    expect(String(caseRequest)).not.toContain("createdTo=");
  });

  it("does not request users when the viewer lacks users:read", () => {
    mockUseAuthBootstrap.mockReturnValue({
      user: { id: "user-1", permissions: ["cases:read"] }
    });

    render();

    expect(
      mockApiFetch.mock.calls.some((call) => call[0] === "/api/users")
    ).toBe(false);
  });
});
