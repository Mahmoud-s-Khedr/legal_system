import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  libraryDocument: {
    findUnique: vi.fn(),
    update: vi.fn()
  }
};

const tesseractExtract = vi.fn();
const googleVisionExtract = vi.fn();

vi.mock("../db/prisma.js", () => ({ prisma }));

vi.mock("../modules/documents/ocr/TesseractAdapter.js", () => ({
  TesseractAdapter: vi.fn().mockImplementation(() => ({
    extract: tesseractExtract
  }))
}));

vi.mock("../modules/documents/ocr/GoogleVisionAdapter.js", () => ({
  GoogleVisionAdapter: vi.fn().mockImplementation(() => ({
    extract: googleVisionExtract
  }))
}));

const { runLibraryExtraction } = await import("./runLibraryExtraction.js");

describe("runLibraryExtraction MIME derivation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tesseractExtract.mockResolvedValue("extracted text");
    googleVisionExtract.mockResolvedValue("extracted text");
    prisma.libraryDocument.update.mockResolvedValue(undefined);
  });

  it.each([
    ["library/firm-1/doc-1/file.webp", "image/webp"],
    ["library/firm-1/doc-1/file.bmp", "image/bmp"],
    ["library/firm-1/doc-1/file.gif", "image/gif"],
    ["library/firm-1/doc-1/file.tif", "image/tiff"],
    ["library/firm-1/doc-1/file.tiff", "image/tiff"],
    ["library/firm-1/doc-1/file.jpg", "image/jpeg"],
    ["library/firm-1/doc-1/file.jpeg", "image/jpeg"],
    ["library/firm-1/doc-1/file.png", "image/png"],
    ["library/firm-1/doc-1/file.pdf", "application/pdf"],
    ["library/firm-1/doc-1/file.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
  ])("maps %s -> %s", async (storageKey, expectedMimeType) => {
    prisma.libraryDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      deletedAt: null,
      storageKey,
      ocrBackend: "TESSERACT"
    });

    const storage = {
      get: vi.fn().mockResolvedValue(Readable.from(Buffer.from("file-bytes")))
    };

    await runLibraryExtraction("doc-1", {} as never, storage as never);

    expect(tesseractExtract).toHaveBeenCalledWith(
      expect.any(Buffer),
      expectedMimeType,
      expect.objectContaining({ documentId: "doc-1", source: "library" })
    );
  });

  it.each([
    ["library/firm-1/doc-1/file.pdf", "application/pdf"],
    [
      "library/firm-1/doc-1/file.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ]
  ])("updates status to INDEXED for %s", async (storageKey, expectedMimeType) => {
    prisma.libraryDocument.findUnique.mockResolvedValue({
      id: "doc-1",
      deletedAt: null,
      storageKey,
      ocrBackend: "TESSERACT"
    });

    const storage = {
      get: vi.fn().mockResolvedValue(Readable.from(Buffer.from("file-bytes")))
    };

    await runLibraryExtraction(
      "doc-1",
      {
        OCR_EMBEDDED_PDF_MAX_PAGES: 25,
        OCR_EMBEDDED_DOCX_MAX_IMAGES: 30,
        OCR_EMBEDDED_IMAGE_MAX_BYTES: 10 * 1024 * 1024
      } as never,
      storage as never
    );

    expect(tesseractExtract).toHaveBeenCalledWith(
      expect.any(Buffer),
      expectedMimeType,
      expect.objectContaining({ documentId: "doc-1", source: "library" })
    );
    expect(prisma.libraryDocument.update).toHaveBeenNthCalledWith(1, {
      where: { id: "doc-1" },
      data: { extractionStatus: "PROCESSING" }
    });
    expect(prisma.libraryDocument.update).toHaveBeenNthCalledWith(2, {
      where: { id: "doc-1" },
      data: { contentText: "extracted text", extractionStatus: "INDEXED" }
    });
  });
});
