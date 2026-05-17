import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  useTemplatesMock,
  mutateAsyncMock,
  exportTemplateDocxMock,
  addToastMock,
  queryMock,
  confirmActionMock
} = vi.hoisted(() => ({
  useTemplatesMock: vi.fn(),
  mutateAsyncMock: vi.fn(),
  exportTemplateDocxMock: vi.fn(),
  addToastMock: vi.fn(),
  queryMock: vi.fn(),
  confirmActionMock: vi.fn()
}));

vi.mock("react-i18next", async () => {
  const actual = await vi.importActual<typeof import("react-i18next")>("react-i18next");
  return {
    ...actual,
    useTranslation: () => ({ t: (key: string) => key })
  };
});

vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children
  }: {
    children: JSX.Element | string;
  }) => <a>{children}</a>
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (...args: unknown[]) => queryMock(...args)
}));

vi.mock("../../store/toastStore", () => ({
  useToastStore: (selector: (state: { addToast: typeof addToastMock }) => unknown) =>
    selector({ addToast: addToastMock })
}));

vi.mock("../../lib/enumLabel", () => ({
  getEnumLabel: (_t: unknown, _type: string, value: string) => value
}));

vi.mock("../../lib/fileSaveFeedback", () => ({
  formatFileSaveSuccessMessage: () => "saved"
}));

vi.mock("../../lib/dialog", () => ({
  confirmAction: (...args: unknown[]) => confirmActionMock(...args)
}));

vi.mock("../../lib/templates", () => ({
  useTemplates: () => useTemplatesMock(),
  useDeleteTemplate: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false
  }),
  exportTemplateDocx: (...args: unknown[]) => exportTemplateDocxMock(...args)
}));

vi.mock("../../lib/caseOptions", () => ({
  toCaseSelectOption: (_t: unknown, caseItem: { id: string; title: string; caseNumber: string }) => ({
    value: caseItem.id,
    label: `${caseItem.title} - ${caseItem.caseNumber}`
  })
}));

vi.mock("./ui", () => ({
  PageHeader: ({ title, actions }: { title: string; actions?: JSX.Element }) => (
    <div>
      <h1>{title}</h1>
      {actions}
    </div>
  ),
  SectionCard: ({ children }: { children: JSX.Element }) => <section>{children}</section>,
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  ErrorState: ({ title }: { title: string }) => <div>{title}</div>,
  SelectField: ({
    label,
    value,
    options,
    onChange
  }: {
    label: string;
    value: string;
    options: Array<{ value: string; label: string }>;
    onChange: (value: string) => void;
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
  )
}));

const { TemplatesPage } = await import("./TemplatesPage");

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(() => {
  useTemplatesMock.mockReturnValue({
    data: [
      {
        id: "11111111-1111-1111-1111-111111111111",
        name: "Template A",
        language: "AR",
        isSystem: false
      }
    ],
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn()
  });
  queryMock.mockReturnValue({
    data: {
      items: [
        {
          id: "22222222-2222-2222-2222-222222222222",
          title: "Case A",
          caseNumber: "C-1"
        }
      ]
    },
    isError: false,
    error: null
  });
  mutateAsyncMock.mockResolvedValue(undefined);
  confirmActionMock.mockResolvedValue(true);
  exportTemplateDocxMock.mockResolvedValue("/tmp/x.docx");
  addToastMock.mockReset();

  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  if (root) {
    act(() => root?.unmount());
  }
  container?.remove();
  root = null;
  container = null;
  vi.clearAllMocks();
});

describe("TemplatesPage", () => {
  it("requires selecting case before direct use export", async () => {
    await act(async () => {
      root?.render(<TemplatesPage />);
    });

    const useButton = Array.from(container?.querySelectorAll("button") ?? []).find((node) =>
      node.textContent?.includes("templates.use")
    ) as HTMLButtonElement | undefined;
    expect(useButton).toBeDefined();

    await act(async () => {
      useButton?.click();
    });

    expect(exportTemplateDocxMock).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith("templates.validation.caseIdRequired", "error");
  });

  it("exports rendered docx from list with selected case", async () => {
    await act(async () => {
      root?.render(<TemplatesPage />);
    });

    const select = container?.querySelector("select") as HTMLSelectElement | null;
    expect(select).toBeTruthy();
    await act(async () => {
      if (select) {
        select.value = "22222222-2222-2222-2222-222222222222";
        select.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });

    const useButton = Array.from(container?.querySelectorAll("button") ?? []).find((node) =>
      node.textContent?.includes("templates.use")
    ) as HTMLButtonElement | undefined;

    await act(async () => {
      useButton?.click();
    });

    expect(exportTemplateDocxMock).toHaveBeenCalledWith(
      "11111111-1111-1111-1111-111111111111",
      "rendered",
      "22222222-2222-2222-2222-222222222222"
    );
  });

  it("does not emit local toast on delete failure (avoids duplicate error toasts)", async () => {
    mutateAsyncMock.mockRejectedValueOnce(new Error("delete failed"));

    await act(async () => {
      root?.render(<TemplatesPage />);
    });

    const buttons = Array.from(container?.querySelectorAll("button") ?? []);
    const deleteButton = buttons.find((node) =>
      node.textContent?.includes("actions.delete")
    ) as HTMLButtonElement | undefined;
    expect(deleteButton).toBeDefined();

    await act(async () => {
      deleteButton?.click();
    });

    expect(addToastMock).not.toHaveBeenCalledWith("delete failed", "error");
  });

  it("opens confirm dialog and only deletes when approved", async () => {
    confirmActionMock.mockResolvedValueOnce(true);

    await act(async () => {
      root?.render(<TemplatesPage />);
    });

    const deleteButton = Array.from(container?.querySelectorAll("button") ?? []).find((node) =>
      node.textContent?.includes("actions.delete")
    ) as HTMLButtonElement | undefined;
    expect(deleteButton).toBeDefined();

    await act(async () => {
      deleteButton?.click();
    });

    expect(confirmActionMock).toHaveBeenCalledWith({
      title: "actions.confirmDelete",
      content: "actions.deleteConfirmMessage",
      okButtonProps: { danger: true }
    });
    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    expect(mutateAsyncMock).toHaveBeenCalledWith("11111111-1111-1111-1111-111111111111");
  });

  it("does not delete when confirmation is canceled", async () => {
    confirmActionMock.mockResolvedValueOnce(false);

    await act(async () => {
      root?.render(<TemplatesPage />);
    });

    const deleteButton = Array.from(container?.querySelectorAll("button") ?? []).find((node) =>
      node.textContent?.includes("actions.delete")
    ) as HTMLButtonElement | undefined;
    expect(deleteButton).toBeDefined();

    await act(async () => {
      deleteButton?.click();
    });

    expect(confirmActionMock).toHaveBeenCalledTimes(1);
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  it("does not trigger duplicate delete requests on rapid clicks", async () => {
    let resolveDelete: (() => void) | null = null;
    mutateAsyncMock.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          resolveDelete = resolve;
        })
    );
    confirmActionMock.mockResolvedValue(true);

    await act(async () => {
      root?.render(<TemplatesPage />);
    });

    const deleteButton = Array.from(container?.querySelectorAll("button") ?? []).find((node) =>
      node.textContent?.includes("actions.delete")
    ) as HTMLButtonElement | undefined;
    expect(deleteButton).toBeDefined();

    await act(async () => {
      deleteButton?.click();
      deleteButton?.click();
    });

    expect(mutateAsyncMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDelete?.();
    });
  });
});
