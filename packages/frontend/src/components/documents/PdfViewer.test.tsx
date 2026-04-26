import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PdfViewer } from "./PdfViewer";

const getDocument = vi.fn();

vi.mock("pdfjs-dist", () => ({
  GlobalWorkerOptions: { workerSrc: "" },
  getDocument
}));

let root: Root | null = null;
let container: HTMLDivElement | null = null;
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
const originalGetContext = HTMLCanvasElement.prototype.getContext;
const originalIntersectionObserver = globalThis.IntersectionObserver;

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
  vi.restoreAllMocks();
});

describe("PdfViewer", () => {
  it("shows page count and supports page jump", async () => {
    getDocument.mockReturnValue({ promise: Promise.resolve(createPdfMock()) });

    const view = render(<PdfViewer url="blob:test" />);

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
