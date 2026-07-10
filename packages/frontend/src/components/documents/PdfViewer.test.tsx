import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfViewer } from "./PdfViewer";

const getDocument = vi.fn();

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalIntersectionObserver = globalThis.IntersectionObserver;
const originalCreateObjectUrl = URL.createObjectURL;
const originalRevokeObjectUrl = URL.revokeObjectURL;
const originalNavigatorDescriptor = Object.getOwnPropertyDescriptor(window, "navigator");

(
  globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

class ImmediateIntersectionObserver {
  private readonly callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
  }

  observe(target: Element) {
    this.callback(
      [
        {
          target,
          isIntersecting: true,
          intersectionRatio: 1,
          boundingClientRect: target.getBoundingClientRect(),
          intersectionRect: target.getBoundingClientRect(),
          rootBounds: null,
          time: 0
        } as IntersectionObserverEntry
      ],
      this as unknown as IntersectionObserver
    );
  }

  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

function createPdfMock() {
  return {
    numPages: 3,
    getPage: vi.fn(async () => ({
      getViewport: vi.fn(() => ({ width: 600, height: 900 })),
      render: vi.fn(() => ({
        promise: Promise.resolve(),
        cancel: vi.fn()
      }))
    }))
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
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  getDocument.mockReset();
  Object.defineProperty(window, "navigator", {
    value: { ...window.navigator, userAgent: "Mozilla/5.0 (X11; Linux x86_64)" },
    configurable: true
  });
  URL.createObjectURL = vi.fn(() => "blob:test-pdf-preview");
  URL.revokeObjectURL = vi.fn();
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLCanvasElement.prototype.getContext = vi.fn(
    () => ({} as unknown as CanvasRenderingContext2D)
  ) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  globalThis.IntersectionObserver = ImmediateIntersectionObserver as unknown as typeof IntersectionObserver;
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
  HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  HTMLCanvasElement.prototype.getContext = originalGetContext;
  globalThis.IntersectionObserver = originalIntersectionObserver;
  URL.createObjectURL = originalCreateObjectUrl;
  URL.revokeObjectURL = originalRevokeObjectUrl;
  if (originalNavigatorDescriptor) {
    Object.defineProperty(window, "navigator", originalNavigatorDescriptor);
  }
  vi.restoreAllMocks();
});

describe("PdfViewer", () => {
  it("uses native viewer fallback when PDF.js fails", async () => {
    getDocument.mockReturnValue({
      promise: Promise.reject(new Error("pdf load failed"))
    });

    const view = render(
      <PdfViewer blob={new Blob(["pdf"], { type: "application/pdf" })} />
    );

    await flushAsyncWork();

    expect(view.querySelector("object")).not.toBeNull();
    expect(view.querySelector("iframe")).not.toBeNull();
  });

  it("uses native fallback when loaded PDF reports zero pages", async () => {
    getDocument.mockReturnValue({
      promise: Promise.resolve({
        numPages: 0,
        getPage: vi.fn()
      })
    });

    const view = render(
      <PdfViewer blob={new Blob(["pdf"], { type: "application/pdf" })} />
    );

    await flushAsyncWork();

    expect(view.querySelector("object")).not.toBeNull();
    expect(view.querySelector("iframe")).not.toBeNull();
  });

  it("shows page count and supports page jump", async () => {
    getDocument.mockReturnValue({ promise: Promise.resolve(createPdfMock()) });

    const view = render(
      <PdfViewer blob={new Blob(["pdf"], { type: "application/pdf" })} />
    );

    await flushAsyncWork();

    expect(view.textContent).toContain("1 / 3");

    const input = view.querySelector("input") as HTMLInputElement;
    expect(input).not.toBeNull();

    await act(async () => {
      input.value = "3";
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });

    const buttons = Array.from(view.querySelectorAll("button"));
    const jumpButton = buttons[buttons.length - 1] as HTMLButtonElement;

    await act(async () => {
      jumpButton.click();
    });

    expect(HTMLElement.prototype.scrollIntoView).toHaveBeenCalled();
  });
});
