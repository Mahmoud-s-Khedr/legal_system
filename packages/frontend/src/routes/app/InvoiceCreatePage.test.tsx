import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn(async () => undefined);
const mutateAsyncMock = vi.fn();
const successMock = vi.fn();
const allowNextNavigationMock = vi.fn();
const useQueryMock = vi.fn();
const useUnsavedChangesMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({})
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (args: unknown) => useQueryMock(args)
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

vi.mock("../../lib/feedback", () => ({
  useMutationFeedback: () => ({
    success: successMock
  })
}));

vi.mock("../../lib/billing", () => ({
  useCreateInvoice: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false
  })
}));

vi.mock("../../lib/useUnsavedChanges", () => ({
  useUnsavedChanges: (...args: unknown[]) => useUnsavedChangesMock(...args),
  useUnsavedChangesBypass: () => ({
    bypassRef: { current: false },
    allowNextNavigation: allowNextNavigationMock
  })
}));

vi.mock("./ui", () => ({
  PageHeader: ({ title, description }: { title: string; description?: string }) => (
    <header>
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
  SectionCard: ({ title, children }: { title: string; children: JSX.Element }) => (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
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
  FormAlert: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  FormExitActions: ({ submitLabel, submitting }: { submitLabel: string; submitting?: boolean }) => (
    <button type="submit" disabled={Boolean(submitting)}>
      {submitLabel}
    </button>
  )
}));

const { InvoiceCreatePage } = await import("./InvoiceCreatePage");

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
    data: { items: [] },
    isLoading: false,
    isError: false,
    error: null
  });
  mutateAsyncMock.mockResolvedValue({ id: "inv-123" });
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

describe("InvoiceCreatePage", () => {
  it("submits invoice, bypasses unsaved-change blocker, and redirects to the new invoice", async () => {
    const view = render(<InvoiceCreatePage />);
    const descriptionInput = view.querySelector(
      'input[placeholder="billing.itemDescription"]'
    ) as HTMLInputElement | null;
    expect(descriptionInput).not.toBeNull();

    act(() => {
      if (descriptionInput) {
        setInputValue(descriptionInput, "Drafting fee");
      }
    });

    const form = view.querySelector("form");
    expect(form).not.toBeNull();

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: null,
        clientId: null,
        feeType: "FIXED",
        taxAmount: "0.00",
        discountAmount: "0.00",
        dueDate: null,
        items: [{ description: "Drafting fee", quantity: 1, unitPrice: "0.00" }]
      })
    );
    expect(successMock).toHaveBeenCalledWith("messages.invoiceCreated");
    expect(allowNextNavigationMock).toHaveBeenCalledTimes(1);
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/app/invoices/$invoiceId",
      params: { invoiceId: "inv-123" }
    });
    expect(useUnsavedChangesMock).toHaveBeenCalled();
    expect(allowNextNavigationMock.mock.invocationCallOrder[0]).toBeLessThan(
      navigateMock.mock.invocationCallOrder[0]
    );
  });

  it("normalizes empty tax and discount to zero before submit", async () => {
    const view = render(<InvoiceCreatePage />);
    const descriptionInput = view.querySelector(
      'input[placeholder="billing.itemDescription"]'
    ) as HTMLInputElement | null;
    const numberInputs = view.querySelectorAll('input[type="number"]');
    const taxInput = numberInputs.item(0) as HTMLInputElement;
    const discountInput = numberInputs.item(1) as HTMLInputElement;

    act(() => {
      if (descriptionInput) setInputValue(descriptionInput, "Drafting fee");
      setInputValue(taxInput, "");
      setInputValue(discountInput, "");
    });

    const form = view.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        taxAmount: "0",
        discountAmount: "0"
      })
    );
  });

  it("clears selected case when user switches to a different client", async () => {
    useQueryMock.mockImplementation((args: { queryKey: string[] }) => {
      if (args.queryKey[0] === "cases") {
        return {
          data: {
            items: [
              {
                id: "case-1",
                clientId: "client-1",
                title: "Case A",
                caseNumber: "A-1",
                status: "ACTIVE",
                parties: [],
                courts: []
              }
            ]
          }
        };
      }
      return {
        data: {
          items: [
            { id: "client-1", name: "Client One", type: "INDIVIDUAL" },
            { id: "client-2", name: "Client Two", type: "INDIVIDUAL" }
          ]
        }
      };
    });

    const view = render(<InvoiceCreatePage />);
    const descriptionInput = view.querySelector(
      'input[placeholder="billing.itemDescription"]'
    ) as HTMLInputElement | null;
    const caseSelect = view.querySelector(
      'select[aria-label="labels.case (labels.optional)"]'
    ) as HTMLSelectElement | null;
    const clientSelect = view.querySelector(
      'select[aria-label="labels.client (labels.optional)"]'
    ) as HTMLSelectElement | null;

    act(() => {
      if (descriptionInput) setInputValue(descriptionInput, "Drafting fee");
      if (caseSelect) setSelectValue(caseSelect, "case-1");
      if (clientSelect) setSelectValue(clientSelect, "client-2");
    });

    expect(caseSelect?.value).toBe("");

    const form = view.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: null, clientId: "client-2" })
    );
  });

  it("clears both case and client using the clear button", async () => {
    useQueryMock.mockImplementation((args: { queryKey: string[] }) => {
      if (args.queryKey[0] === "cases") {
        return {
          data: {
            items: [
              {
                id: "case-1",
                clientId: "client-1",
                title: "Case A",
                caseNumber: "A-1",
                status: "ACTIVE",
                parties: [],
                courts: []
              }
            ]
          }
        };
      }
      return {
        data: {
          items: [
            { id: "client-1", name: "Client One", type: "INDIVIDUAL" }
          ]
        }
      };
    });

    const view = render(<InvoiceCreatePage />);
    const descriptionInput = view.querySelector(
      'input[placeholder="billing.itemDescription"]'
    ) as HTMLInputElement | null;
    const caseSelect = view.querySelector(
      'select[aria-label="labels.case (labels.optional)"]'
    ) as HTMLSelectElement | null;
    const clearButton = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "billing.clearCaseAndClient"
    ) as HTMLButtonElement | undefined;

    act(() => {
      if (descriptionInput) setInputValue(descriptionInput, "Drafting fee");
      if (caseSelect) setSelectValue(caseSelect, "case-1");
      clearButton?.click();
    });

    expect(caseSelect?.value).toBe("");

    const form = view.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({ caseId: null, clientId: null })
    );
  });
});
