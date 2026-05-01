import { Readable } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  document: {
    findUnique: vi.fn(),
    update: vi.fn()
  }
};

const tesseractExtract = vi.fn();
const dispatchNotification = vi.fn();
const normalizeArabic = vi.fn((value: string) => value);
const TesseractAdapter = vi.fn().mockImplementation(() => ({
  extract: tesseractExtract
}));

vi.mock("../db/prisma.js", () => ({ prisma }));
vi.mock("../modules/documents/ocr/TesseractAdapter.js", () => ({
  TesseractAdapter
}));
vi.mock("../modules/documents/ocr/GoogleVisionAdapter.js", () => ({
  GoogleVisionAdapter: vi.fn().mockImplementation(() => ({
    extract: vi.fn()
  }))
}));
vi.mock("../modules/notifications/notification.service.js", () => ({
  dispatchNotification
}));
vi.mock("../utils/arabic.js", () => ({
  normalizeArabic
}));

const { runExtraction } = await import("./runExtraction.js");

describe("runExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tesseractExtract.mockResolvedValue("merged raw text");
    prisma.document.update.mockResolvedValue(undefined);
    dispatchNotification.mockResolvedValue(undefined);
  });

  it.each([
    ["application/pdf"],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
  ])("indexes %s using tesseract and updates status", async (mimeType) => {
    const env = {
      OCR_EMBEDDED_PDF_MAX_PAGES: 25,
      OCR_EMBEDDED_DOCX_MAX_IMAGES: 30,
      OCR_EMBEDDED_IMAGE_MAX_BYTES: 10 * 1024 * 1024,
      MAX_UPLOAD_BYTES: 50 * 1024 * 1024
    } as never;

    prisma.document.findUnique.mockResolvedValue({
      id: "doc-1",
      deletedAt: null,
      storageKey: "firm/doc/file",
      mimeType,
      ocrBackend: "TESSERACT",
      uploadedById: null,
      firmId: "firm-1"
    });

    const storage = {
      get: vi.fn().mockResolvedValue(Readable.from(Buffer.from("file-bytes")))
    };

    await runExtraction("doc-1", env, storage as never);

    expect(TesseractAdapter).toHaveBeenCalledWith(env);
    expect(tesseractExtract).toHaveBeenCalledWith(
      expect.any(Buffer),
      mimeType,
      expect.objectContaining({ documentId: "doc-1", source: "documents" })
    );
    expect(prisma.document.update).toHaveBeenNthCalledWith(1, {
      where: { id: "doc-1" },
      data: { extractionStatus: "PROCESSING" }
    });
    expect(prisma.document.update).toHaveBeenNthCalledWith(2, {
      where: { id: "doc-1" },
      data: { contentText: "merged raw text", extractionStatus: "INDEXED" }
    });
  });

  it("marks extraction as failed when stream exceeds configured memory limit", async () => {
    const env = {
      OCR_EMBEDDED_PDF_MAX_PAGES: 25,
      OCR_EMBEDDED_DOCX_MAX_IMAGES: 30,
      OCR_EMBEDDED_IMAGE_MAX_BYTES: 1024,
      MAX_UPLOAD_BYTES: 1024
    } as never;

    prisma.document.findUnique.mockResolvedValue({
      id: "doc-2",
      deletedAt: null,
      storageKey: "firm/doc/large",
      mimeType: "application/pdf",
      ocrBackend: "TESSERACT",
      uploadedById: null,
      firmId: "firm-1"
    });

    const storage = {
      get: vi.fn().mockResolvedValue(Readable.from(Buffer.alloc(2048, 1)))
    };

    await runExtraction("doc-2", env, storage as never);

    expect(tesseractExtract).not.toHaveBeenCalled();
    expect(prisma.document.update).toHaveBeenNthCalledWith(1, {
      where: { id: "doc-2" },
      data: { extractionStatus: "PROCESSING" }
    });
    expect(prisma.document.update).toHaveBeenNthCalledWith(2, {
      where: { id: "doc-2" },
      data: { extractionStatus: "FAILED" }
    });
  });
});
