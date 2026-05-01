import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FilePreview } from "./FilePreview";
import { apiDownload } from "../../lib/api";
import { resolvePreviewLimitBytes } from "./filePreviewConfig";

vi.mock("../../lib/api", () => ({
  apiDownload: vi.fn()
}));
vi.mock("./filePreviewConfig", async () => {
  const actual = await vi.importActual<typeof import("./filePreviewConfig")>("./filePreviewConfig");
  return {
    ...actual,
    resolvePreviewLimitBytes: vi.fn(actual.resolvePreviewLimitBytes)
  };
});

vi.mock("./PdfViewer", () => ({
  PdfViewer: ({ blob }: { blob: Blob }) => (
    <div data-testid="pdf-viewer">{blob.type}</div>
  )
}));

vi.mock("./DocxViewer", () => ({
  DocxViewer: () => <div data-testid="docx-viewer" />
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key
  })
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const originalCreateObjectURL = URL.createObjectURL;
const originalRevokeObjectURL = URL.revokeObjectURL;

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

async function flushAsyncWork() {
  await act(async () => {
    await Promise.resolve();
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

describe("FilePreview", () => {
  it("renders PDF viewer when preview is ready", async () => {
    vi.mocked(apiDownload).mockResolvedValue({
      blob: new Blob(["pdf"], { type: "application/pdf" }),
      contentType: "application/pdf"
    });
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:pdf")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });

    const view = render(
      <FilePreview
        cacheKey="doc-1"
        mimeType="application/pdf"
        streamUrl="/api/documents/doc-1/stream"
        title="Doc"
      />
    );
    await flushAsyncWork();

    expect(view.querySelector("[data-testid='pdf-viewer']")?.textContent).toBe("application/pdf");
  });

  it("shows unsupported state for unknown mime type", async () => {
    const view = render(
      <FilePreview
        cacheKey="doc-2"
        mimeType="application/zip"
        streamUrl="/api/documents/doc-2/stream"
        title="Doc"
      />
    );
    await flushAsyncWork();

    expect(view.textContent).toContain("documents.previewNotSupported");
    expect(apiDownload).not.toHaveBeenCalled();
  });

  it("falls back to too_large when content length crosses threshold", async () => {
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn(() => "blob:oversized")
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: vi.fn()
    });
    vi.mocked(apiDownload).mockResolvedValue({
      blob: new Blob([new Uint8Array(26 * 1024 * 1024)], { type: "application/pdf" }),
      contentType: "application/pdf",
      contentLength: 26 * 1024 * 1024
    });
    vi.mocked(resolvePreviewLimitBytes).mockReturnValue(1);

    const view = render(
      <FilePreview
        cacheKey="doc-3"
        mimeType="application/pdf"
        streamUrl="/api/documents/doc-3/stream"
        title="Doc"
      />
    );
    await flushAsyncWork();

    expect(view.textContent).toContain("documents.previewTooLarge");
  });
});
