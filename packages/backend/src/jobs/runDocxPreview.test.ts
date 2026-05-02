import { Readable } from "node:stream";
import fsPromises from "node:fs/promises";
import path from "node:path";
import type { ChildProcess } from "node:child_process";
import { beforeEach, describe, expect, it, vi } from "vitest";

const prisma = {
  document: {
    findUnique: vi.fn(),
    update: vi.fn()
  }
};

vi.mock("../db/prisma.js", () => ({ prisma }));
vi.mock("node:child_process", () => ({
  execFile: vi.fn((...callArgs: unknown[]) => {
    const cb = callArgs[callArgs.length - 1] as ((err: Error | null) => void) | undefined;
    cb?.(null);
  })
}));

const { runDocxPreview } = await import("./runDocxPreview.js");

describe("runDocxPreview", () => {
  const env = {
    DOCX_PREVIEW_ENABLED: true,
    DOCX_PREVIEW_BIN: "libreoffice",
    DOCX_PREVIEW_TIMEOUT_MS: 60000
  } as never;

  const storage = {
    get: vi.fn().mockResolvedValue(Readable.from(["docx"])),
    put: vi.fn().mockResolvedValue(undefined)
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates status to READY after successful conversion", async () => {
    const { execFile } = await import("node:child_process");
    vi.mocked(execFile).mockImplementationOnce((...callArgs: unknown[]) => {
      const args = callArgs[1] as readonly string[] | undefined;
      const cb = callArgs[callArgs.length - 1] as ((err: Error | null) => void) | undefined;
      const outDir = String(args?.[6]);
      const outputPath = path.join(outDir, "input.pdf");
      void fsPromises
        .mkdir(outDir, { recursive: true })
        .then(() => fsPromises.writeFile(outputPath, Buffer.from("pdf-output")))
        .then(() => cb?.(null));
      return {} as ChildProcess;
    });

    prisma.document.findUnique.mockResolvedValue({
      id: "doc-1",
      firmId: "firm-1",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: "firm-1/doc-1/input.docx",
      deletedAt: null
    });
    prisma.document.update.mockResolvedValue(undefined);

    await runDocxPreview("doc-1", "firm-1", env, storage as never);

    expect(prisma.document.update).toHaveBeenNthCalledWith(1, {
      where: { id: "doc-1" },
      data: { previewStatus: "PROCESSING" }
    });
    expect(prisma.document.update).toHaveBeenNthCalledWith(2, {
      where: { id: "doc-1" },
      data: {
        previewPdfKey: "firm-1/doc-1/preview.pdf",
        previewStatus: "READY"
      }
    });
    expect(storage.put).toHaveBeenCalled();
  });

  it("marks status FAILED when conversion throws", async () => {
    const { execFile } = await import("node:child_process");
    vi.mocked(execFile).mockImplementationOnce((...callArgs: unknown[]) => {
      const cb = callArgs[callArgs.length - 1] as ((err: Error | null) => void) | undefined;
      cb?.(new Error("conversion failed"));
      return {} as ChildProcess;
    });

    prisma.document.findUnique.mockResolvedValue({
      id: "doc-1",
      firmId: "firm-1",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: "firm-1/doc-1/input.docx",
      deletedAt: null
    });
    prisma.document.update.mockResolvedValue(undefined);

    await runDocxPreview("doc-1", "firm-1", env, storage as never);

    expect(prisma.document.update).toHaveBeenNthCalledWith(2, {
      where: { id: "doc-1" },
      data: { previewStatus: "FAILED" }
    });
  });

  it("skips processing when job firmId does not match document firm", async () => {
    prisma.document.findUnique.mockResolvedValue({
      id: "doc-1",
      firmId: "firm-2",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      storageKey: "firm-2/doc-1/input.docx",
      deletedAt: null
    });

    await runDocxPreview("doc-1", "firm-1", env, storage as never);

    expect(prisma.document.update).not.toHaveBeenCalled();
    expect(storage.put).not.toHaveBeenCalled();
  });
});
