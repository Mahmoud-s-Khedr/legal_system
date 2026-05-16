import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const useExpensesMock = vi.fn();
const updateExpenseMutateAsyncMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (args: unknown) => useQueryMock(args)
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

vi.mock("../../lib/billing", () => ({
  useExpenses: (...args: unknown[]) => useExpensesMock(...args),
  useCreateExpense: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  }),
  useDeleteExpense: () => ({
    mutateAsync: vi.fn(),
    isPending: false
  }),
  useUpdateExpense: () => ({
    mutateAsync: updateExpenseMutateAsyncMock,
    isPending: false
  })
}));

vi.mock("../../lib/lookups", () => ({
  useLocalizedLookupOptions: () => ({
    options: [
      { value: "COURT_FEE", label: "Court Fee" },
      { value: "TRAVEL", label: "Travel" }
    ],
    getLabel: (key: string) =>
      key === "COURT_FEE" ? "Court Fee" : key === "TRAVEL" ? "Travel" : key
  })
}));

vi.mock("../../lib/tableQueryState", () => ({
  useTableQueryState: () => ({
    state: {
      q: "",
      sortBy: "createdAt",
      sortDir: "desc",
      page: 1,
      limit: 20,
      filters: { category: "" }
    },
    setQ: vi.fn(),
    setSort: vi.fn(),
    setPage: vi.fn(),
    setLimit: vi.fn(),
    setFilter: vi.fn()
  })
}));

vi.mock("./ui", () => ({
  PageHeader: ({
    title,
    description,
    actions
  }: {
    title: string;
    description: string;
    actions?: JSX.Element;
  }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
      {actions}
    </header>
  ),
  SectionCard: ({
    title,
    children
  }: {
    title: string;
    children: JSX.Element;
  }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  ),
  Field: ({
    label,
    value,
    onChange,
    placeholder
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
  }) => (
    <label>
      {label}
      <input
        aria-label={label}
        value={value}
        placeholder={placeholder}
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
  TableToolbar: ({ children }: { children: JSX.Element[] }) => <div>{children}</div>,
  TableWrapper: ({ children }: { children: JSX.Element }) => <div>{children}</div>,
  DataTable: ({ children }: { children: JSX.Element[] }) => <table>{children}</table>,
  TableHead: ({ children }: { children: JSX.Element }) => <thead>{children}</thead>,
  SortableTableHeadCell: ({ label }: { label: string }) => <th>{label}</th>,
  TableHeadCell: ({ children }: { children: string }) => <th>{children}</th>,
  TableBody: ({ children }: { children: JSX.Element[] }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: JSX.Element }) => <tr>{children}</tr>,
  TableCell: ({
    children
  }: {
    children: JSX.Element | string;
  }) => <td>{children}</td>,
  TablePagination: () => <div />,
  ErrorState: ({ title }: { title: string }) => <div>{title}</div>,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  formatCurrency: (value: string) => value
}));

const { ExpensesPage } = await import("./ExpensesPage");

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

function setInputValue(element: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  );
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(element: HTMLSelectElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(
    HTMLSelectElement.prototype,
    "value"
  );
  descriptor?.set?.call(element, value);
  element.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  useQueryMock.mockReturnValue({
    data: {
      items: [
        {
          id: "case-2",
          title: "Case B",
          caseNumber: "B-1",
          clientId: "c-1",
          status: "ACTIVE",
          parties: [],
          courts: []
        }
      ]
    },
    isLoading: false,
    isError: false,
    error: null
  });
  useExpensesMock.mockReturnValue({
    data: {
      items: [
        {
          id: "exp-1",
          category: "COURT_FEE",
          amount: "100.00",
          description: "Old note",
          caseId: "case-1",
          caseTitle: "Case A"
        }
      ],
      total: 1
    },
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn()
  });
  updateExpenseMutateAsyncMock.mockResolvedValue({ id: "exp-1" });
});

afterEach(() => {
  if (root) {
    act(() => {
      root?.unmount();
    });
  }
  container?.remove();
  container = null;
  root = null;
});

describe("ExpensesPage", () => {
  it("uses expense-specific search placeholder and category select options", () => {
    const view = render(<ExpensesPage />);
    const searchInput = view.querySelector(
      'input[aria-label="labels.search"]'
    ) as HTMLInputElement | null;
    expect(searchInput?.placeholder).toBe("billing.expenseSearchPlaceholder");

    const categoryFilter = view.querySelector(
      'select[aria-label="billing.category"]'
    ) as HTMLSelectElement | null;
    expect(categoryFilter).not.toBeNull();
    expect(categoryFilter?.textContent).toContain("labels.all");
    expect(categoryFilter?.textContent).toContain("Court Fee");
    expect(view.textContent).toContain("Court Fee");
  });

  it("includes an empty option for optional case selection", () => {
    const view = render(<ExpensesPage />);

    const logButton = Array.from(view.querySelectorAll("button")).find(
      (btn) => btn.textContent === "billing.logExpense"
    );
    act(() => {
      logButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const caseSelect = view.querySelector(
      'select[aria-label="labels.case (labels.optional)"]'
    ) as HTMLSelectElement | null;

    expect(caseSelect).not.toBeNull();
    expect(caseSelect?.textContent).toContain("labels.none");
  });

  it("submits edited category and caseId through update mutation", async () => {
    const view = render(<ExpensesPage />);
    const editButton = Array.from(view.querySelectorAll("button")).find(
      (btn) => btn.textContent === "actions.edit"
    );
    expect(editButton).toBeDefined();

    act(() => {
      editButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const categorySelect = Array.from(
      view.querySelectorAll('select[aria-label="billing.category"]')
    ).at(-1) as HTMLSelectElement | undefined;
    const caseSelect = view.querySelector(
      'select[aria-label="labels.case (labels.optional)"]'
    ) as HTMLSelectElement | null;
    const descriptionInput = view.querySelector(
      'input[value="Old note"]'
    ) as HTMLInputElement | null;

    expect(categorySelect).toBeDefined();
    expect(caseSelect).not.toBeNull();
    expect(descriptionInput).not.toBeNull();

    act(() => {
      if (categorySelect) setSelectValue(categorySelect, "TRAVEL");
      if (caseSelect) setSelectValue(caseSelect, "case-2");
      if (descriptionInput) setInputValue(descriptionInput, "Updated note");
    });

    const saveButton = Array.from(view.querySelectorAll("button")).find(
      (btn) => btn.textContent === "actions.save"
    );

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(updateExpenseMutateAsyncMock).toHaveBeenCalledWith({
      id: "exp-1",
      data: {
        category: "TRAVEL",
        amount: "100.00",
        description: "Updated note",
        caseId: "case-2"
      }
    });
  });
});
