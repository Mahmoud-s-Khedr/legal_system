import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createExpenseMutateAsyncMock = vi.fn();
const deleteExpenseMutateAsyncMock = vi.fn();
const addToastMock = vi.fn();
const confirmActionMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: string }) => <a>{children}</a>
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

vi.mock("../../store/toastStore", () => ({
  useToastStore: () => addToastMock
}));

vi.mock("../../lib/dialog", () => ({
  confirmAction: (...args: unknown[]) => confirmActionMock(...args)
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

vi.mock("../../lib/billing", () => ({
  useCaseBillingSummary: () => ({
    isLoading: false,
    isError: false,
    data: {
      totalBilled: "100.00",
      totalPaid: "50.00",
      outstanding: "50.00",
      totalExpenses: "20.00",
      profitability: "30.00"
    }
  }),
  useInvoices: () => ({
    isLoading: false,
    isError: false,
    data: { items: [] }
  }),
  useExpenses: () => ({
    isLoading: false,
    isError: false,
    data: {
      items: [
        { id: "exp-1", category: "COURT_FEE", amount: "20.00", description: "D1" }
      ]
    },
    refetch: vi.fn()
  }),
  useCreateExpense: () => ({
    mutateAsync: createExpenseMutateAsyncMock,
    isPending: false
  }),
  useDeleteExpense: () => ({
    mutateAsync: deleteExpenseMutateAsyncMock,
    isPending: false
  })
}));

vi.mock("../../routes/app/ui", () => ({
  SectionCard: ({ children }: { children: JSX.Element | JSX.Element[] }) => (
    <section>{children}</section>
  ),
  ErrorState: ({ title }: { title: string }) => <div>{title}</div>,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  FormAlert: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  TableWrapper: ({ children }: { children: JSX.Element }) => <div>{children}</div>,
  DataTable: ({ children }: { children: JSX.Element[] }) => <table>{children}</table>,
  TableHead: ({ children }: { children: JSX.Element }) => <thead>{children}</thead>,
  TableHeadCell: ({ children }: { children: string }) => <th>{children}</th>,
  TableBody: ({ children }: { children: JSX.Element[] }) => <tbody>{children}</tbody>,
  TableRow: ({ children }: { children: JSX.Element }) => <tr>{children}</tr>,
  TableCell: ({ children }: { children: JSX.Element | string }) => <td>{children}</td>,
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
  formatCurrency: (value: string) => value
}));

const { CaseBillingTab } = await import("./CaseBillingTab");

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
  createExpenseMutateAsyncMock.mockResolvedValue({ id: "exp-2" });
  deleteExpenseMutateAsyncMock.mockResolvedValue({ success: true });
  confirmActionMock.mockResolvedValue(true);
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

describe("CaseBillingTab expenses", () => {
  it("renders localized expense category label in the list", () => {
    const view = render(<CaseBillingTab caseId="case-1" />);
    expect(view.textContent).toContain("Court Fee");
  });

  it("uses category dropdown and submits lookup key", async () => {
    const view = render(<CaseBillingTab caseId="case-1" />);
    const logButton = Array.from(view.querySelectorAll("button")).find(
      (btn) => btn.textContent === "billing.logExpense"
    );

    act(() => {
      logButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const categorySelect = view.querySelector(
      'select[aria-label="billing.category"]'
    ) as HTMLSelectElement | null;
    const amountInput = view.querySelector(
      'input[type="number"]'
    ) as HTMLInputElement | null;

    expect(categorySelect).not.toBeNull();
    expect(categorySelect?.textContent).toContain("Court Fee");

    act(() => {
      if (categorySelect) setSelectValue(categorySelect, "TRAVEL");
      if (amountInput) setInputValue(amountInput, "33.50");
    });

    const saveButton = Array.from(view.querySelectorAll("button")).find(
      (btn) => btn.textContent === "billing.save"
    );
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(createExpenseMutateAsyncMock).toHaveBeenCalledWith({
      caseId: "case-1",
      category: "TRAVEL",
      amount: "33.50",
      description: null
    });
  });

  it("requires confirmation before deleting expense", async () => {
    const view = render(<CaseBillingTab caseId="case-1" />);
    const deleteButton = Array.from(view.querySelectorAll("button")).find(
      (btn) => btn.textContent === "actions.delete"
    );
    await act(async () => {
      deleteButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(confirmActionMock).toHaveBeenCalled();
    expect(deleteExpenseMutateAsyncMock).toHaveBeenCalledWith("exp-1");
  });

  it("uses localized fallback on create error", async () => {
    createExpenseMutateAsyncMock.mockRejectedValueOnce(new Error(""));
    const view = render(<CaseBillingTab caseId="case-1" />);
    const logButton = Array.from(view.querySelectorAll("button")).find(
      (btn) => btn.textContent === "billing.logExpense"
    );

    act(() => {
      logButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const amountInput = view.querySelector(
      'input[type="number"]'
    ) as HTMLInputElement | null;
    const saveButton = Array.from(view.querySelectorAll("button")).find(
      (btn) => btn.textContent === "billing.save"
    );

    act(() => {
      if (amountInput) setInputValue(amountInput, "5");
    });
    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(view.textContent).toContain("errors.fallback");
  });
});
