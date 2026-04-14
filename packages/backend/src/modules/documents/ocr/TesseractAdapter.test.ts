import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TesseractAdapter, resolveTesseractRuntimeOptions } from "./TesseractAdapter.js";

const {
  mockCreateWorker,
  mockExtractRawText,
  mockExtractEmbeddedPdfImageText,
  mockExtractEmbeddedDocxImageText,
  getMockPdfText,
  setMockPdfText
} = vi.hoisted(() => {
  let mockPdfText = "";
  return {
    mockCreateWorker: vi.fn(),
    mockExtractRawText: vi.fn(),
    mockExtractEmbeddedPdfImageText: vi.fn(),
    mockExtractEmbeddedDocxImageText: vi.fn(),
    getMockPdfText: () => mockPdfText,
    setMockPdfText: (value: string) => {
      mockPdfText = value;
    }
  };
});

vi.mock("tesseract.js", () => ({
  createWorker: mockCreateWorker
}));

vi.mock("mammoth", () => ({
  extractRawText: mockExtractRawText
}));

vi.mock("pdf-parse", () => ({
  PDFParse: class {
    constructor(options: unknown) {
      void options;
    }
    async getText() {
      return { text: getMockPdfText() };
    }
  }
}));

vi.mock("./EmbeddedImageOcr.js", () => ({
  extractEmbeddedPdfImageText: mockExtractEmbeddedPdfImageText,
  extractEmbeddedDocxImageText: mockExtractEmbeddedDocxImageText,
  resolveEmbeddedOcrLimits: vi.fn((env) => ({
    pdfMaxPages: env?.OCR_EMBEDDED_PDF_MAX_PAGES ?? 25,
    docxMaxImages: env?.OCR_EMBEDDED_DOCX_MAX_IMAGES ?? 30,
    maxImageBytes: env?.OCR_EMBEDDED_IMAGE_MAX_BYTES ?? 10 * 1024 * 1024
  }))
}));

describe("resolveTesseractRuntimeOptions", () => {
  it("returns existing runtime asset paths", () => {
    const runtimeOptions = resolveTesseractRuntimeOptions();

    expect(existsSync(runtimeOptions.workerPath)).toBe(true);
    expect(existsSync(runtimeOptions.corePath)).toBe(true);
  });
});

describe("TesseractAdapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    setMockPdfText("");
    mockExtractRawText.mockResolvedValue({ value: "" });
    mockExtractEmbeddedPdfImageText.mockResolvedValue([]);
    mockExtractEmbeddedDocxImageText.mockResolvedValue([]);
  });

  it("returns empty text and logs context when worker initialization fails", async () => {
    mockCreateWorker.mockImplementationOnce(async () => {
      const error = new Error("worker init failed") as Error & { code: string };
      error.code = "MODULE_NOT_FOUND";
      throw error;
    });
    const logSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const adapter = new TesseractAdapter();
    const text = await adapter.extract(Buffer.from("fake-image"), "image/png", {
      documentId: "doc-123",
      source: "documents",
    });

    expect(text).toBe("");
    expect(logSpy).toHaveBeenCalledWith(
      "[ocr:tesseract] Image extraction failed",
      expect.objectContaining({
        documentId: "doc-123",
        source: "documents",
        errorCode: "MODULE_NOT_FOUND",
      })
    );
  });

  it("merges parser text with OCR text for PDFs", async () => {
    setMockPdfText("parser pdf text");
    mockExtractEmbeddedPdfImageText.mockResolvedValueOnce(["ocr page 1", "", "ocr page 2"]);

    const adapter = new TesseractAdapter();
    const text = await adapter.extract(Buffer.from("pdf"), "application/pdf", {
      documentId: "doc-pdf",
      source: "documents"
    });

    expect(text).toBe("parser pdf text\n\nocr page 1\n\nocr page 2");
  });

  it("merges parser text with OCR text for DOCX", async () => {
    mockExtractRawText.mockResolvedValueOnce({ value: "docx body text" });
    mockExtractEmbeddedDocxImageText.mockResolvedValueOnce(["ocr image 1"]);

    const adapter = new TesseractAdapter();
    const text = await adapter.extract(
      Buffer.from("docx"),
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      {
        documentId: "doc-docx",
        source: "library"
      }
    );

    expect(text).toBe("docx body text\n\nocr image 1");
  });

  it("passes configured embedded OCR limits to PDF image extraction", async () => {
    setMockPdfText("parser");
    const adapter = new TesseractAdapter({
      OCR_EMBEDDED_PDF_MAX_PAGES: 4,
      OCR_EMBEDDED_DOCX_MAX_IMAGES: 7,
      OCR_EMBEDDED_IMAGE_MAX_BYTES: 2048
    });

    await adapter.extract(Buffer.from("pdf"), "application/pdf");

    expect(mockExtractEmbeddedPdfImageText).toHaveBeenCalledWith(
      expect.any(Buffer),
      { pdfMaxPages: 4, docxMaxImages: 7, maxImageBytes: 2048 },
      expect.any(Function),
      undefined
    );
  });
});
