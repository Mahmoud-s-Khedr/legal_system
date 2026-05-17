import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../../../i18n";
import { LibraryUploadPage } from "./LibraryUploadPage";

const {
  invalidateQueries,
  navigateSpy,
  runUploadQueueMock,
  mockState
} = vi.hoisted(() => ({
  invalidateQueries: vi.fn(),
  navigateSpy: vi.fn(),
  runUploadQueueMock: vi.fn(),
  mockState: {
    typesData: [] as Array<{
      id: string;
      code: string;
      nameAr: string;
      nameEn: string;
      nameFr: string;
      isActive: boolean;
    }>,
    categoriesData: [] as Array<{ id: string; nameEn: string }>
  }
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown[] }) => {
    const key = options.queryKey?.[0];
    if (key === "library-types") {
      return {
        data: mockState.typesData,
        isLoading: false,
        isError: false,
        error: null
      };
    }
    if (key === "library-categories") {
      return {
        data: mockState.categoriesData,
        isLoading: false,
        isError: false,
        error: null
      };
    }
    return { data: [], isLoading: false, isError: false, error: null };
  },
  useQueryClient: () => ({ invalidateQueries })
}));

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    useNavigate: () => navigateSpy
  };
});

vi.mock("../../../lib/uploadQueue", () => ({
  runUploadQueue: runUploadQueueMock
}));

vi.mock("../ui", () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  ErrorState: ({ title }: { title: string }) => <div>{title}</div>,
  Field: ({ label }: { label: string }) => <div>{label}</div>,
  PageHeader: ({ title }: { title: string }) => <h1>{title}</h1>,
  SectionCard: ({ children }: { children: JSX.Element | JSX.Element[] }) => (
    <section>{children}</section>
  ),
  PrimaryButton: ({
    children,
    onClick,
    disabled
  }: {
    children: JSX.Element | JSX.Element[] | string;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
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
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">--</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

beforeEach(async () => {
  vi.clearAllMocks();
  mockState.typesData = [
    {
      id: "type-1",
      code: "LEGISLATION",
      nameAr: "نوع",
      nameEn: "Legislation",
      nameFr: "Législation",
      isActive: true
    }
  ];
  mockState.categoriesData = [];
  runUploadQueueMock.mockResolvedValue({
    successCount: 1,
    failedCount: 0,
    results: [{ index: 0, status: "success", result: { id: "doc-1" } }]
  });

  await act(async () => {
    await i18n.changeLanguage("en");
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

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

function uploadSingleFile(view: HTMLDivElement, name = "law.pdf") {
  const input = view.querySelector('input[type="file"]') as HTMLInputElement | null;
  expect(input).toBeTruthy();
  const file = new File(["test"], name, { type: "application/pdf" });

  act(() => {
    Object.defineProperty(input!, "files", {
      configurable: true,
      value: [file]
    });
    input!.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

describe("LibraryUploadPage", () => {
  it("shows firm-only upload hint", () => {
    const view = render(<LibraryUploadPage />);

    expect(view.textContent).toContain(
      i18n.t("library.uploadFirmOnlyHint", { ns: "app" })
    );
  });

  it("does not show scope selector", () => {
    const view = render(<LibraryUploadPage />);

    expect(view.textContent).not.toContain(i18n.t("library.scope", { ns: "app" }));
  });

  it("uses expanded safe image/scanner accept types", () => {
    const view = render(<LibraryUploadPage />);
    const input = view.querySelector('input[type="file"]');
    expect(input?.getAttribute("accept")).toBe(
      ".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff,.webp,.bmp,.gif"
    );
  });

  it("localizes legislation status options", () => {
    const view = render(<LibraryUploadPage />);
    const text = view.textContent ?? "";

    expect(text).toContain(i18n.t("enums.LegislationStatus.ACTIVE", { ns: "app" }));
    expect(text).toContain(i18n.t("enums.LegislationStatus.AMENDED", { ns: "app" }));
    expect(text).toContain(i18n.t("enums.LegislationStatus.REPEALED", { ns: "app" }));
    expect(text).not.toContain("AMENDED");
    expect(text).not.toContain("REPEALED");
  });

  it("enables upload without category when type is selected and file exists", async () => {
    const view = render(<LibraryUploadPage />);
    uploadSingleFile(view);

    const uploadButton = Array.from(view.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes(i18n.t("library.upload", { ns: "app" }))
    );
    expect(uploadButton).toBeTruthy();
    expect(uploadButton?.hasAttribute("disabled")).toBe(false);

    await act(async () => {
      uploadButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(runUploadQueueMock).toHaveBeenCalledTimes(1);
  });

  it("shows inline validation metadata issues", () => {
    mockState.typesData = [];
    const view = render(<LibraryUploadPage />);

    expect(view.textContent).toContain(
      i18n.t("library.validationTypeRequired", { ns: "app" })
    );
  });

  it("shows per-file failure reason when upload fails", async () => {
    runUploadQueueMock.mockImplementationOnce(
      async ({ onStatusChange }: { onStatusChange?: (index: number, status: "failed", error?: string) => void }) => {
        onStatusChange?.(0, "failed", "Unsupported or undetectable file type");
        return {
          successCount: 0,
          failedCount: 1,
          results: [
            {
              index: 0,
              status: "failed",
              error: new Error("Unsupported or undetectable file type")
            }
          ]
        };
      }
    );

    const view = render(<LibraryUploadPage />);
    uploadSingleFile(view);

    const uploadButton = Array.from(view.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes(i18n.t("library.upload", { ns: "app" }))
    );

    await act(async () => {
      uploadButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(view.textContent).toContain("Unsupported or undetectable file type");
  });

  it("redirects to library page when all uploads succeed", async () => {
    const view = render(<LibraryUploadPage />);
    uploadSingleFile(view);

    const uploadButton = Array.from(view.querySelectorAll("button")).find((button) =>
      (button.textContent ?? "").includes(i18n.t("library.upload", { ns: "app" }))
    );

    await act(async () => {
      uploadButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(navigateSpy).toHaveBeenCalledWith({ to: "/app/library" });
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ["library-documents"] });
  });
});
