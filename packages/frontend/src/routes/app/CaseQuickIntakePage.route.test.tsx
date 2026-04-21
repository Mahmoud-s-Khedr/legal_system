import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ClientType } from "@elms/shared";

const navigateMock = vi.fn();
const permissionMap: Record<string, boolean> = {};
const queryMock = vi.fn();
const invalidateQueriesMock = vi.fn(async () => undefined);
const successMock = vi.fn();
const allowNextNavigationMock = vi.fn();
const runUploadQueueMock = vi.fn();
const apiFetchMock = vi.fn();
const apiFormFetchMock = vi.fn();
const createClientMutateAsyncMock = vi.fn();
const createCaseMutateAsyncMock = vi.fn();
let mutationCallIndex = 0;

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    to
  }: {
    children: JSX.Element | string;
    to: string;
  }) => <a href={to}>{children}</a>,
  useNavigate: () => navigateMock,
  useSearch: () => ({ clientId: "client-existing" })
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => queryMock(...args),
  useQueryClient: () => ({
    invalidateQueries: invalidateQueriesMock
  }),
  useMutation: () => {
    const index = mutationCallIndex++ % 2;
    if (index === 0) {
      return {
        mutateAsync: createClientMutateAsyncMock,
        isPending: false,
        error: null
      };
    }
    return {
      mutateAsync: createCaseMutateAsyncMock,
      isPending: false,
      error: null
    };
  }
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en", language: "en" }
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
  useMutationFeedback: () => ({
    success: successMock
  })
}));

vi.mock("../../lib/lookups", () => ({
  useLookupOptions: (key: string) => {
    if (key === "CaseType") {
      return { data: { items: [{ key: "CIVIL", labelAr: "Civil" }] } };
    }
    if (key === "CourtLevel") {
      return { data: { items: [{ key: "FIRST", labelAr: "First" }] } };
    }
    if (key === "PartyRole") {
      return { data: { items: [{ key: "PLAINTIFF", labelAr: "Plaintiff" }] } };
    }
    if (key === "DocumentType") {
      return { data: { items: [{ key: "GENERAL", labelAr: "General" }] } };
    }
    return { data: { items: [] } };
  }
}));

vi.mock("../../lib/uploadQueue", () => ({
  runUploadQueue: (...args: unknown[]) => runUploadQueueMock(...args)
}));

vi.mock("../../lib/api", () => ({
  apiFetch: (...args: unknown[]) => apiFetchMock(...args),
  apiFormFetch: (...args: unknown[]) => apiFormFetchMock(...args)
}));

vi.mock("../../lib/egyptGovernorates", () => ({
  getEgyptGovernorateOptions: () => []
}));

vi.mock("../../lib/enumLabel", () => ({
  getEnumLabel: (_t: unknown, _enum: string, value: string) => value
}));

vi.mock("../../store/authStore", () => ({
  useHasPermission: (permission: string) => permissionMap[permission] ?? false
}));

vi.mock("./ui", () => ({
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  SectionCard: ({
    title,
    description,
    children
  }: {
    title: string;
    description?: string;
    children: JSX.Element;
  }) => (
    <section>
      <h2>{title}</h2>
      <p>{description}</p>
      {children}
    </section>
  ),
  Field: ({
    id,
    label,
    value,
    onChange,
    type = "text"
  }: {
    id?: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
  }) => (
    <label>
      {label}
      <input
        id={id}
        aria-label={label}
        value={value}
        type={type}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    </label>
  ),
  SelectField: ({
    id,
    label,
    value,
    onChange,
    options
  }: {
    id?: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
  }) => (
    <label>
      {label}
      <select
        id={id}
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
  FormExitActions: ({
    submitLabel,
    submitting,
    disabled
  }: {
    submitLabel: string;
    submitting?: boolean;
    disabled?: boolean;
  }) => (
    <button type="submit" disabled={Boolean(submitting || disabled)}>
      {submitLabel}
    </button>
  )
}));

const { CaseQuickIntakePage } = await import("./CaseQuickIntakePage");

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

function setInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    "value"
  )?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSelectValue(select: HTMLSelectElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    window.HTMLSelectElement.prototype,
    "value"
  )?.set;
  setter?.call(select, value);
  select.dispatchEvent(new Event("change", { bubbles: true }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mutationCallIndex = 0;
  Object.keys(permissionMap).forEach((key) => delete permissionMap[key]);
  permissionMap["cases:create"] = true;
  permissionMap["clients:read"] = true;
  permissionMap["clients:create"] = true;
  permissionMap["cases:update"] = true;
  permissionMap["cases:assign"] = true;
  permissionMap["cases:status"] = true;
  permissionMap["hearings:create"] = true;
  permissionMap["tasks:create"] = true;

  queryMock.mockImplementation((input: { queryKey: string[] }) => {
    const key = input.queryKey[0];
    if (key === "clients") {
      return {
        data: { items: [{ id: "client-existing", name: "Client Existing" }] },
        isError: false,
        error: null
      };
    }
    if (key === "users") {
      return {
        data: { items: [{ id: "user-1", fullName: "Lawyer One" }] },
        isError: false,
        error: null
      };
    }
    return { data: { items: [] }, isError: false, error: null };
  });

  createClientMutateAsyncMock.mockResolvedValue({
    id: "client-created",
    name: "Client Created"
  });
  createCaseMutateAsyncMock.mockResolvedValue({ id: "case-1" });
  runUploadQueueMock.mockResolvedValue({ failedCount: 0 });
  apiFetchMock.mockResolvedValue({});
  apiFormFetchMock.mockResolvedValue({});
});

afterEach(() => {
  unmountCurrent();
});

describe("CaseQuickIntakePage route behavior", () => {
  it("shows permission gate when user cannot create cases", () => {
    permissionMap["cases:create"] = false;
    const view = render(<CaseQuickIntakePage />);
    expect(view.textContent).toContain("quickIntake.noCasePermission");
  });

  it("shows validation message when required fields are missing", () => {
    const view = render(<CaseQuickIntakePage />);
    const form = view.querySelector("form");

    act(() => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(view.textContent).toContain("quickIntake.validation.caseRequired");
    expect(createCaseMutateAsyncMock).not.toHaveBeenCalled();
  });

  it("submits quick intake successfully with existing client", async () => {
    const view = render(<CaseQuickIntakePage />);
    const titleInput = view.querySelector(
      'input[aria-label="labels.caseTitle"]'
    ) as HTMLInputElement | null;
    const caseNumberInput = view.querySelector(
      'input[aria-label="labels.caseNumber"]'
    ) as HTMLInputElement | null;
    const form = view.querySelector("form");

    act(() => {
      if (titleInput) setInputValue(titleInput, "Case A");
      if (caseNumberInput) setInputValue(caseNumberInput, "2026/001");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(createClientMutateAsyncMock).not.toHaveBeenCalled();
    expect(createCaseMutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-existing",
        title: "Case A",
        caseNumber: "2026/001"
      })
    );
    expect(successMock).toHaveBeenCalledWith("messages.caseCreated");
    expect(allowNextNavigationMock).toHaveBeenCalled();
    expect(navigateMock).toHaveBeenCalledWith({
      to: "/app/cases/$caseId",
      params: { caseId: "case-1" }
    });
  });

  it("creates inline client and shows summary when optional section fails", async () => {
    apiFetchMock.mockImplementation((url: string) => {
      if (url.includes("/courts")) {
        throw new Error("court failed");
      }
      return Promise.resolve({});
    });

    const view = render(<CaseQuickIntakePage />);
    const switchButton = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent === "quickIntake.createClientInline"
    );
    act(() => {
      switchButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const clientNameInput = view.querySelector(
      'input[aria-label="labels.name"]'
    ) as HTMLInputElement | null;
    const typeSelect = view.querySelector(
      'select[aria-label="labels.type"]'
    ) as HTMLSelectElement | null;
    const titleInput = view.querySelector(
      'input[aria-label="labels.caseTitle"]'
    ) as HTMLInputElement | null;
    const caseNumberInput = view.querySelector(
      'input[aria-label="labels.caseNumber"]'
    ) as HTMLInputElement | null;
    const courtNameInput = view.querySelector(
      'input[aria-label="labels.courtName"]'
    ) as HTMLInputElement | null;
    const courtLevelSelect = view.querySelector(
      'select[aria-label="labels.courtLevel"]'
    ) as HTMLSelectElement | null;
    const form = view.querySelector("form");

    act(() => {
      if (clientNameInput) setInputValue(clientNameInput, "New Client");
      if (typeSelect) setSelectValue(typeSelect, ClientType.INDIVIDUAL);
      if (titleInput) setInputValue(titleInput, "Case B");
      if (caseNumberInput) setInputValue(caseNumberInput, "2026/002");
      if (courtNameInput) setInputValue(courtNameInput, "Court X");
      if (courtLevelSelect) setSelectValue(courtLevelSelect, "FIRST");
    });

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(createClientMutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "New Client",
        type: ClientType.INDIVIDUAL
      })
    );
    expect(createCaseMutateAsyncMock).toHaveBeenCalledWith(
      expect.objectContaining({
        clientId: "client-created",
        title: "Case B"
      })
    );
    expect(view.textContent).toContain("quickIntake.savedWithIssues");
    expect(navigateMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: "/app/cases/$caseId" })
    );
  });
});
