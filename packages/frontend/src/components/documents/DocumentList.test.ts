import { describe, expect, it } from "vitest";
import { DocumentType, ExtractionStatus, OcrBackend, type DocumentDto } from "@elms/shared";
import { canShowIndexedText } from "./DocumentList";

function makeDoc(overrides: Partial<DocumentDto>): DocumentDto {
  return {
    id: "doc-1",
    firmId: "firm-1",
    caseId: null,
    clientId: null,
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

describe("canShowIndexedText", () => {
  it("returns true only for indexed documents with extracted text", () => {
    expect(canShowIndexedText(makeDoc({ extractionStatus: ExtractionStatus.INDEXED, contentText: "text" }))).toBe(true);
  });

  it("returns false when extraction is not indexed", () => {
    expect(canShowIndexedText(makeDoc({ extractionStatus: ExtractionStatus.PENDING, contentText: "text" }))).toBe(false);
    expect(canShowIndexedText(makeDoc({ extractionStatus: ExtractionStatus.PROCESSING, contentText: "text" }))).toBe(false);
    expect(canShowIndexedText(makeDoc({ extractionStatus: ExtractionStatus.FAILED, contentText: "text" }))).toBe(false);
  });

  it("returns false when content is empty even if indexed", () => {
    expect(canShowIndexedText(makeDoc({ extractionStatus: ExtractionStatus.INDEXED, contentText: "" }))).toBe(false);
    expect(canShowIndexedText(makeDoc({ extractionStatus: ExtractionStatus.INDEXED, contentText: "   " }))).toBe(false);
    expect(canShowIndexedText(makeDoc({ extractionStatus: ExtractionStatus.INDEXED, contentText: null }))).toBe(false);
  });
});
