import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const navigateMock = vi.fn();
const invalidateQueriesMock = vi.fn(async () => undefined);
const successMock = vi.fn();
const allowNextNavigationMock = vi.fn();
const mutateAsyncMock = vi.fn();
const queryMock = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({ clientId: "client-1" })
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => queryMock(...args),
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
  useMutation: (config: { mutationFn: (payload: unknown) => Promise<unknown>; onSuccess?: (result: { id: string }) => Promise<void> | void }) => ({
    mutateAsync: async (payload: unknown) => {
      const result = await config.mutationFn(payload);
      await config.onSuccess?.(result as { id: string });
      return result;
    },
    isPending: false
  })
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key
  })
}));

vi.mock("../../lib/useUnsavedChanges", () => ({
  useUnsavedChanges: vi.fn(),
  useUnsavedChangesBypass: () => ({
    bypassRef: { current: false },
    allowNextNavigation: allowNextNavigationMock
  })
}));

vi.mock("../../lib/feedback", () => ({
  useMutationFeedback: () => ({ success: successMock })
}));

vi.mock("../../lib/lookups", () => ({
  useLocalizedLookupOptions: () => ({
    options: [{ value: "CIVIL", label: "Civil", searchText: "CIVIL Civil" }],
    getLabel: (value: string) => value
  })
}));

vi.mock("../../lib/api", () => ({
  apiFetch: (...args: unknown[]) => mutateAsyncMock(...args)
}));

vi.mock("./ui", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  SectionCard: ({ children }: { children: JSX.Element }) => <section>{children}</section>,
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
        type={type}
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
  FormAlert: ({ message }: { message: string }) => <div role="alert">{message}</div>,
  FormExitActions: ({ submitLabel }: { submitLabel: string }) => (
    <button type="submit">{submitLabel}</button>
  )
}));

const { CaseCreatePage } = await import("./CaseCreatePage");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  queryMock.mockReturnValue({
    data: { items: [{ id: "client-1", name: "Client One" }] }
  });
  mutateAsyncMock.mockResolvedValue({ id: "case-1" });
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  root = null;
  container?.remove();
  container = null;
});

describe("CaseCreatePage", () => {
  it("renders judicial year field", () => {
    const view = render(<CaseCreatePage />);
    expect(view.querySelector('input[aria-label="labels.judicialYear"]')).not.toBeNull();
  });

  it("blocks submit on negative judicial year", async () => {
    const view = render(<CaseCreatePage />);
    const titleInput = view.querySelector('input[aria-label="labels.caseTitle"]') as HTMLInputElement | null;
    const caseNumberInput = view.querySelector('input[aria-label="labels.caseNumber"]') as HTMLInputElement | null;
    const judicialYearInput = view.querySelector('input[aria-label="labels.judicialYear"]') as HTMLInputElement | null;
    const form = view.querySelector("form");

    act(() => {
      if (titleInput) setInputValue(titleInput, "Case");
      if (caseNumberInput) setInputValue(caseNumberInput, "2026/001");
      if (judicialYearInput) setInputValue(judicialYearInput, "-1");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(view.textContent).toContain("Judicial year must be zero or greater.");
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("submits null judicial year when empty", async () => {
    const view = render(<CaseCreatePage />);
    const titleInput = view.querySelector('input[aria-label="labels.caseTitle"]') as HTMLInputElement | null;
    const caseNumberInput = view.querySelector('input[aria-label="labels.caseNumber"]') as HTMLInputElement | null;
    const form = view.querySelector("form");

    act(() => {
      if (titleInput) setInputValue(titleInput, "Case");
      if (caseNumberInput) setInputValue(caseNumberInput, "2026/002");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      "/api/cases",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"judicialYear":null')
      })
    );
  });

  it("submits positive judicial year value", async () => {
    const view = render(<CaseCreatePage />);
    const titleInput = view.querySelector('input[aria-label="labels.caseTitle"]') as HTMLInputElement | null;
    const caseNumberInput = view.querySelector('input[aria-label="labels.caseNumber"]') as HTMLInputElement | null;
    const judicialYearInput = view.querySelector('input[aria-label="labels.judicialYear"]') as HTMLInputElement | null;
    const form = view.querySelector("form");

    act(() => {
      if (titleInput) setInputValue(titleInput, "Case");
      if (caseNumberInput) setInputValue(caseNumberInput, "2026/003");
      if (judicialYearInput) setInputValue(judicialYearInput, "2026");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mutateAsyncMock).toHaveBeenCalledWith(
      "/api/cases",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"judicialYear":2026')
      })
    );
  });
});
