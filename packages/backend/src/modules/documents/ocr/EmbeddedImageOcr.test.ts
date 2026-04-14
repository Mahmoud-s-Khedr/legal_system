import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractEmbeddedDocxImageText,
  extractEmbeddedPdfImageText,
  resolveEmbeddedOcrLimits
} from "./EmbeddedImageOcr.js";

const { mockGetDocument, mockCreateCanvas } = vi.hoisted(() => ({
  mockGetDocument: vi.fn(),
  mockCreateCanvas: vi.fn()
}));

vi.mock("pdfjs-dist/legacy/build/pdf.mjs", () => ({
  getDocument: mockGetDocument
}));

vi.mock("@napi-rs/canvas", () => ({
  createCanvas: mockCreateCanvas
}));

function createPdfPage(imageBuffer: Buffer) {
  return {
    getViewport: vi.fn(() => ({ width: 100, height: 100 })),
    render: vi.fn(() => ({ promise: Promise.resolve() })),
    cleanup: vi.fn(),
    __imageBuffer: imageBuffer
  };
}

describe("resolveEmbeddedOcrLimits", () => {
  it("uses defaults when env values are not provided", () => {
    expect(resolveEmbeddedOcrLimits()).toEqual({
      pdfMaxPages: 25,
      docxMaxImages: 30,
      maxImageBytes: 10 * 1024 * 1024
    });
  });
});

describe("extractEmbeddedPdfImageText", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("enforces page and size limits deterministically", async () => {
    const pages = [
      createPdfPage(Buffer.from("p1")),
      createPdfPage(Buffer.from("p2")),
      createPdfPage(Buffer.alloc(20))
    ];
    let canvasIndex = 0;

    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: pages.length,
        getPage: async (index: number) => pages[index - 1]
      }),
      destroy: vi.fn().mockResolvedValue(undefined)
    });

    mockCreateCanvas.mockImplementation(() => {
      const page = pages[canvasIndex++];
      return {
        getContext: vi.fn(() => ({})),
        toBuffer: vi.fn(() => page.__imageBuffer)
      };
    });

    const extracted = await extractEmbeddedPdfImageText(
      Buffer.from("fake-pdf"),
      { pdfMaxPages: 3, docxMaxImages: 30, maxImageBytes: 10 },
      vi.fn(async (img) => `ocr-${img.toString("utf8")}`)
    );

    expect(extracted).toEqual(["ocr-p1", "ocr-p2"]);
  });

  it("continues when one page fails OCR path", async () => {
    const pages = [createPdfPage(Buffer.from("ok1")), createPdfPage(Buffer.from("ok3"))];
    let canvasIndex = 0;

    mockGetDocument.mockReturnValueOnce({
      promise: Promise.resolve({
        numPages: 3,
        getPage: async (index: number) => {
          if (index === 2) {
            throw new Error("page read failed");
          }
          return pages[index === 1 ? 0 : 1];
        }
      }),
      destroy: vi.fn().mockResolvedValue(undefined)
    });

    mockCreateCanvas.mockImplementation(() => {
      const page = pages[canvasIndex++];
      return {
        getContext: vi.fn(() => ({})),
        toBuffer: vi.fn(() => page.__imageBuffer)
      };
    });

    const extracted = await extractEmbeddedPdfImageText(
      Buffer.from("fake-pdf"),
      { pdfMaxPages: 3, docxMaxImages: 30, maxImageBytes: 1000 },
      vi.fn(async (img) => `ocr-${img.toString("utf8")}`)
    );

    expect(extracted).toEqual(["ocr-ok1", "ocr-ok3"]);
  });
});

describe("extractEmbeddedDocxImageText", () => {
  it("enforces DOCX image cap and stable ordering", async () => {
    const zip = new JSZip();
    zip.file("word/media/z.png", "z");
    zip.file("word/media/a.png", "a");
    zip.file("word/media/b.jpg", "b");
    zip.file("word/media/skip.svg", "<svg />");
    const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    const extracted = await extractEmbeddedDocxImageText(
      buffer,
      { pdfMaxPages: 25, docxMaxImages: 2, maxImageBytes: 1000 },
      vi.fn(async (img) => `ocr-${img.toString("utf8")}`)
    );

    expect(extracted).toEqual(["ocr-a", "ocr-b"]);
  });

  it("continues when one embedded image OCR fails", async () => {
    const zip = new JSZip();
    zip.file("word/media/image1.png", "first");
    zip.file("word/media/image2.png", "second");
    const buffer = Buffer.from(await zip.generateAsync({ type: "uint8array" }));

    const ocrFn = vi
      .fn()
      .mockRejectedValueOnce(new Error("ocr failed"))
      .mockResolvedValueOnce("ocr-second");

    const extracted = await extractEmbeddedDocxImageText(
      buffer,
      { pdfMaxPages: 25, docxMaxImages: 30, maxImageBytes: 1000 },
      async (img) => ocrFn(img)
    );

    expect(extracted).toEqual(["ocr-second"]);
  });
});
