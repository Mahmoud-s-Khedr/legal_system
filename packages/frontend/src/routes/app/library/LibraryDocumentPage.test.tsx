import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LibraryDocumentPage } from "./LibraryDocumentPage";
import { apiDownload, type ApiDownloadResult } from "../../../lib/api";
import { saveBlobToDownloads } from "../../../lib/desktopDownloads";
import { showErrorDialog } from "../../../lib/dialog";

const { mockUseQuery, mockUseMutation, mockUseQueryClient } = vi.hoisted(() => ({
  mockUseQuery: vi.fn(),
  mockUseMutation: vi.fn(),
  mockUseQueryClient: vi.fn()
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: mockUseQuery,
  useMutation: mockUseMutation,
  useQueryClient: mockUseQueryClient
}));

vi.mock("@tanstack/react-router", () => ({
  useParams: () => ({ documentId: "doc-1" }),
  Link: ({ children }: { children: unknown }) => <a>{children as never}</a>
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { resolvedLanguage: "en" }
  })
}));

vi.mock("../../../lib/api", () => ({
  apiFetch: vi.fn(),
  apiDownload: vi.fn()
}));

vi.mock("../../../lib/desktopDownloads", () => ({
  saveBlobToDownloads: vi.fn()
}));

vi.mock("../../../lib/dialog", () => ({
  showErrorDialog: vi.fn()
}));

vi.mock("../../../components/documents/PdfViewer", () => ({
  PdfViewer: () => <div data-testid="pdf-viewer" />
}));

vi.mock("../../../components/documents/DocxViewer", () => ({
  DocxViewer: () => <div data-testid="docx-viewer" />
}));

vi.mock("../ui", () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
  ErrorState: ({ title }: { title: string }) => <div>{title}</div>,
  PageHeader: ({ actions }: { actions?: unknown }) => <div>{actions as never}</div>,
  PrimaryButton: ({ children, onClick, disabled }: { children: unknown; onClick?: () => void; disabled?: boolean }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children as never}
    </button>
  ),
  SectionCard: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  formatDate: () => "2026-04-26"
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const baseDocument = {
  id: "doc-1",
  title: "Law One",
  type: "LEGISLATION",
  scope: "FIRM",
  publishedAt: null,
  status: null,
  description: "Description",
  descriptionAr: null,
  fileUrl: null,
  storageKey: "library/doc-1/law.pdf",
  mimeType: "application/pdf",
  category: null,
  articles: [],
  annotations: []
};

function render() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(<LibraryDocumentPage />);
  });
  return container;
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
  });
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

beforeEach(() => {
  vi.clearAllMocks();

  mockUseQueryClient.mockReturnValue({ invalidateQueries: vi.fn() });
  mockUseMutation.mockReturnValue({
    mutate: vi.fn(),
    isPending: false
  });
  mockUseQuery.mockReturnValue({
    isLoading: false,
    isError: false,
    data: baseDocument,
    refetch: vi.fn()
  });

  if (!("createObjectURL" in URL)) {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: () => ""
    });
  }
  if (!("revokeObjectURL" in URL)) {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: () => undefined
    });
  }

  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:preview");
  vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
});

describe("LibraryDocumentPage download", () => {
  it("downloads via authenticated stream and falls back filename to title", async () => {
    const previewBlob = new Blob(["preview"], { type: "application/pdf" });
    const downloadBlob = new Blob(["download"], { type: "application/pdf" });

    vi.mocked(apiDownload)
      .mockResolvedValueOnce({
        blob: previewBlob,
        filename: "preview.pdf",
        contentType: "application/pdf"
      })
      .mockResolvedValueOnce({
        blob: downloadBlob,
        filename: undefined,
        contentType: "application/pdf"
      });

    const view = render();
    await flushAsyncWork();

    const downloadButton = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("library.downloadFile")
    ) as HTMLButtonElement | undefined;

    expect(downloadButton).toBeDefined();

    act(() => {
      downloadButton?.click();
    });
    await flushAsyncWork();

    expect(apiDownload).toHaveBeenNthCalledWith(2, "/api/library/documents/doc-1/stream");
    expect(saveBlobToDownloads).toHaveBeenCalledWith(downloadBlob, "Law One");
  });

  it("disables download button while download is in progress", async () => {
    const previewBlob = new Blob(["preview"], { type: "application/pdf" });
    const inFlight = deferred<ApiDownloadResult>();

    vi.mocked(apiDownload)
      .mockResolvedValueOnce({
        blob: previewBlob,
        filename: "preview.pdf",
        contentType: "application/pdf"
      })
      .mockReturnValueOnce(inFlight.promise);

    const view = render();
    await flushAsyncWork();

    const downloadButton = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("library.downloadFile")
    ) as HTMLButtonElement;

    act(() => {
      downloadButton.click();
    });

    expect(downloadButton.disabled).toBe(true);

    await act(async () => {
      inFlight.resolve({
        blob: new Blob(["done"], { type: "application/pdf" }),
        filename: "done.pdf",
        contentType: "application/pdf"
      });
      await inFlight.promise;
    });

    expect(downloadButton.disabled).toBe(false);
  });

  it("shows fallback error dialog when download fails", async () => {
    const previewBlob = new Blob(["preview"], { type: "application/pdf" });

    vi.mocked(apiDownload)
      .mockResolvedValueOnce({
        blob: previewBlob,
        filename: "preview.pdf",
        contentType: "application/pdf"
      })
      .mockRejectedValueOnce(new Error("forbidden"));

    const view = render();
    await flushAsyncWork();

    const downloadButton = Array.from(view.querySelectorAll("button")).find(
      (button) => button.textContent?.includes("library.downloadFile")
    ) as HTMLButtonElement;

    await act(async () => {
      downloadButton.click();
      await Promise.resolve();
    });

    expect(showErrorDialog).toHaveBeenCalledWith("errors.fallback");
  });
});
