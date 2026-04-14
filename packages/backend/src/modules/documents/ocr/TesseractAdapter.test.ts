import { existsSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TesseractAdapter, resolveTesseractRuntimeOptions } from "./TesseractAdapter.js";

vi.mock("tesseract.js", () => ({
  createWorker: vi.fn(async () => {
    const error = new Error("worker init failed") as Error & { code: string };
    error.code = "MODULE_NOT_FOUND";
    throw error;
  }),
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
  });

  it("returns empty text and logs context when worker initialization fails", async () => {
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
});
