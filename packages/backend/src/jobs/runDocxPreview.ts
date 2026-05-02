import { execFile } from "node:child_process";
import fs from "node:fs";
import fsPromises from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { prisma } from "../db/prisma.js";
import type { AppEnv } from "../config/env.js";
import type { IStorageAdapter } from "../storage/IStorageAdapter.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

function execFileAsync(command: string, args: string[], timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: timeoutMs }, (error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

async function cleanupTempDir(tempDir: string) {
  try {
    await fsPromises.rm(tempDir, { recursive: true, force: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[docx-preview] temp cleanup failed", { tempDir, errorMessage: message });
  }
}

export async function runDocxPreview(
  documentId: string,
  firmId: string,
  env: AppEnv,
  storage: IStorageAdapter
): Promise<void> {
  if (!env.DOCX_PREVIEW_ENABLED) {
    return;
  }

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.deletedAt || doc.firmId !== firmId) {
    return;
  }

  if (doc.mimeType !== DOCX_MIME) {
    return;
  }

  await prisma.document.update({
    where: { id: documentId },
    data: { previewStatus: "PROCESSING" }
  });

  const tempDir = await fsPromises.mkdtemp(path.join(os.tmpdir(), "docx-preview-"));
  const outputDir = path.join(tempDir, "out");
  const inputPath = path.join(tempDir, "input.docx");
  const outputPath = path.join(outputDir, "input.pdf");

  try {
    await fsPromises.mkdir(outputDir, { recursive: true });

    const stream = await storage.get(doc.storageKey);
    await pipeline(stream, fs.createWriteStream(inputPath));

    const args = [
      "--headless",
      "--nologo",
      "--nofirststartwizard",
      "--convert-to",
      "pdf",
      "--outdir",
      outputDir,
      inputPath
    ];

    await execFileAsync(env.DOCX_PREVIEW_BIN, args, env.DOCX_PREVIEW_TIMEOUT_MS);

    await fsPromises.access(outputPath);

    const previewKey = `${doc.firmId}/${doc.id}/preview.pdf`;
    await storage.put(previewKey, fs.createReadStream(outputPath), PDF_MIME);

    await prisma.document.update({
      where: { id: documentId },
      data: { previewPdfKey: previewKey, previewStatus: "READY" }
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[docx-preview] conversion failed", { documentId, errorMessage: message });

    await prisma.document.update({
      where: { id: documentId },
      data: { previewStatus: "FAILED" }
    });
  } finally {
    await cleanupTempDir(tempDir);
  }
}
