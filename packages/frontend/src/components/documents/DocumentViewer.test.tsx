import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DocumentType,
  ExtractionStatus,
  OcrBackend,
  type DocumentDto
} from "@elms/shared";
import { DocumentViewer } from "./DocumentViewer";
import { apiDownload } from "../../lib/api";

vi.mock("../../lib/api", () => ({
  apiDownload: vi.fn()
}));

vi.mock("../../lib/desktopDownloads", () => ({
  saveBlobToDownloads: vi.fn()
}));

vi.mock("../../lib/dialog", () => ({
  showErrorDialog: vi.fn()
}));

vi.mock("./VersionHistory", () => ({
  VersionHistory: () => <div data-testid="version-history" />
}));

vi.mock("./PdfViewer", () => ({
  PdfViewer: ({ url }: { url: string }) => (
    <div data-testid="pdf-viewer">{url}</div>
  )
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function makeDoc(overrides: Partial<DocumentDto>): DocumentDto {
  return {
    id: "doc-1",
    firmId: "firm-1",
    caseId: null,
    clientId: null,
    taskId: null,
    uploadedById: null,
    title: "Test document",
    fileName: "test.pdf",
    mimeType: "application/pdf",
    storageKey: "firm-1/doc-1/test.pdf",
    type: DocumentType.GENERAL,
    extractionStatus: ExtractionStatus.INDEXED,
    ocrBackend: OcrBackend.TESSERACT,
    contentText: "sample indexed text",
    versions: [],
    createdAt: "2026-03-01T00:00:00.000Z",
    updatedAt: "2026-03-01T00:00:00.000Z",
    ...overrides
  };
}

function render(element: JSX.Element) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  act(() => {
    root?.render(element);
  });
  return container;
}

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
  });
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
  Object.defineProperty(URL, "createObjectURL", {
    configurable: true,
    writable: true,
    value: originalCreateObjectURL
  });
  Object.defineProperty(URL, "revokeObjectURL", {
    configurable: true,
    writable: true,
    value: originalRevokeObjectURL
  });
  vi.restoreAllMocks();
});

describe("DocumentViewer", () => {
  it("loads PDF preview via authenticated stream and renders object URL", async () => {
    const blob = new Blob(["pdf"], { type: "application/pdf" });
    vi.mocked(apiDownload).mockResolvedValue({
      blob,
      filename: "test.pdf",
      contentType: "application/pdf"
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:pdf-preview")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
    const createObjectUrlSpy = vi.mocked(URL.createObjectURL);

    const view = render(
      <DocumentViewer
        document={makeDoc({})}
        onClose={() => undefined}
        onVersionUploaded={() => undefined}
      />
    );

    await flushAsyncWork();

    expect(apiDownload).toHaveBeenCalledWith("/api/documents/doc-1/stream");
    expect(createObjectUrlSpy).toHaveBeenCalledWith(blob);
    expect(view.querySelector("[data-testid='pdf-viewer']")?.textContent).toBe(
      "blob:pdf-preview"
    );
  });

  it("renders image preview using object URL", async () => {
    const blob = new Blob(["image"], { type: "image/png" });
    vi.mocked(apiDownload).mockResolvedValue({
      blob,
      filename: "test.png",
      contentType: "image/png"
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:image-preview")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });

    const view = render(
      <DocumentViewer
        document={makeDoc({
          id: "doc-img",
          fileName: "image.png",
          mimeType: "image/png"
        })}
        onClose={() => undefined}
        onVersionUploaded={() => undefined}
      />
    );

    await flushAsyncWork();

    const image = view.querySelector("img");
    expect(image?.getAttribute("src")).toBe("blob:image-preview");
  });

  it("revokes previous object URL on document change and unmount", async () => {
    vi.mocked(apiDownload)
      .mockResolvedValueOnce({
        blob: new Blob(["first"], { type: "application/pdf" }),
        filename: "first.pdf",
        contentType: "application/pdf"
      })
      .mockResolvedValueOnce({
        blob: new Blob(["second"], { type: "application/pdf" }),
        filename: "second.pdf",
        contentType: "application/pdf"
      });

    const createObjectUrlMock = vi
      .fn(() => "blob:first")
      .mockImplementationOnce(() => "blob:first")
      .mockImplementationOnce(() => "blob:second");
    const revokeSpy = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectUrlMock
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeSpy
    });

    render(
      <DocumentViewer
        document={makeDoc({ id: "doc-1" })}
        onClose={() => undefined}
        onVersionUploaded={() => undefined}
      />
    );
    await flushAsyncWork();

    act(() => {
      root?.render(
        <DocumentViewer
          document={makeDoc({ id: "doc-2" })}
          onClose={() => undefined}
          onVersionUploaded={() => undefined}
        />
      );
    });
    await flushAsyncWork();

    expect(revokeSpy).toHaveBeenCalledWith("blob:first");

    act(() => {
      root?.unmount();
    });
    root = null;

    expect(revokeSpy).toHaveBeenCalledWith("blob:second");
  });

  it("shows preview error state when stream fetch fails", async () => {
    vi.mocked(apiDownload).mockRejectedValue(new Error("Unauthorized"));
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:unused")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });

    const view = render(
      <DocumentViewer
        document={makeDoc({})}
        onClose={() => undefined}
        onVersionUploaded={() => undefined}
      />
    );

    await flushAsyncWork();
    const error = view.querySelector("p.text-red-600");
    expect(error).not.toBeNull();
    expect((error?.textContent ?? "").trim().length).toBeGreaterThan(0);
    const fallbackText = view.querySelector("pre");
    expect(fallbackText?.textContent).toContain("sample indexed text");
  });

  it("reloads preview when the same document receives a new version", async () => {
    vi.mocked(apiDownload)
      .mockResolvedValueOnce({
        blob: new Blob(["first"], { type: "application/pdf" }),
        filename: "first.pdf",
        contentType: "application/pdf"
      })
      .mockResolvedValueOnce({
        blob: new Blob(["second"], { type: "application/pdf" }),
        filename: "second.pdf",
        contentType: "application/pdf"
      });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:preview")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });

    render(
      <DocumentViewer
        document={makeDoc({
          id: "doc-1",
          updatedAt: "2026-03-01T00:00:00.000Z",
          versions: [
            {
              id: "v1",
              documentId: "doc-1",
              versionNumber: 1,
              fileName: "a.pdf",
              storageKey: "k1",
              createdAt: "2026-03-01T00:00:00.000Z"
            }
          ]
        })}
        onClose={() => undefined}
        onVersionUploaded={() => undefined}
      />
    );
    await flushAsyncWork();

    act(() => {
      root?.render(
        <DocumentViewer
          document={makeDoc({
            id: "doc-1",
            updatedAt: "2026-03-02T00:00:00.000Z",
            versions: [
              {
                id: "v2",
                documentId: "doc-1",
                versionNumber: 2,
                fileName: "b.pdf",
                storageKey: "k2",
                createdAt: "2026-03-02T00:00:00.000Z"
              }
            ]
          })}
          onClose={() => undefined}
          onVersionUploaded={() => undefined}
        />
      );
    });
    await flushAsyncWork();

    expect(apiDownload).toHaveBeenCalledTimes(2);
  });

  it("renders a large preview modal surface", async () => {
    vi.mocked(apiDownload).mockResolvedValue({
      blob: new Blob(["pdf"], { type: "application/pdf" }),
      filename: "test.pdf",
      contentType: "application/pdf"
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:pdf-preview")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });

    const view = render(
      <DocumentViewer
        document={makeDoc({})}
        onClose={() => undefined}
        onVersionUploaded={() => undefined}
      />
    );

    await flushAsyncWork();

    const modal = view.querySelector(".shadow-2xl");
    expect(modal?.className).toContain("w-[95vw]");
    expect(modal?.className).toContain("md:w-[70vw]");
  });
});
