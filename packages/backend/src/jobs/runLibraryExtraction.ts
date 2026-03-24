import { prisma } from "../db/prisma.js";
import { normalizeArabic } from "../utils/arabic.js";
import { TesseractAdapter } from "../modules/documents/ocr/TesseractAdapter.js";
import { GoogleVisionAdapter } from "../modules/documents/ocr/GoogleVisionAdapter.js";
import type { IStorageAdapter } from "../storage/IStorageAdapter.js";
import type { AppEnv } from "../config/env.js";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
  }
  return Buffer.concat(chunks);
}

export async function runLibraryExtraction(
  libraryDocumentId: string,
  env: AppEnv,
  storage: IStorageAdapter
): Promise<void> {
  const doc = await prisma.libraryDocument.findUnique({ where: { id: libraryDocumentId } });
  if (!doc || doc.deletedAt || !doc.storageKey) return;

  await prisma.libraryDocument.update({
    where: { id: libraryDocumentId },
    data: { extractionStatus: "PROCESSING" }
  });

  try {
    const stream = await storage.get(doc.storageKey);
    const buffer = await streamToBuffer(stream);

    // mimeType is not stored on LibraryDocument; derive from storageKey extension
    const ext = doc.storageKey.split(".").pop()?.toLowerCase() ?? "";
    const mimeType =
      ext === "pdf"  ? "application/pdf" :
      ext === "docx" ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document" :
      ext === "png"  ? "image/png" :
      ext === "tiff" ? "image/tiff" :
      "image/jpeg";

    const adapter =
      doc.ocrBackend === "GOOGLE_VISION"
        ? new GoogleVisionAdapter(env)
        : new TesseractAdapter();

    const rawText = await adapter.extract(buffer, mimeType);
    const contentText = normalizeArabic(rawText);

    await prisma.libraryDocument.update({
      where: { id: libraryDocumentId },
      data: { contentText, extractionStatus: "INDEXED" }
    });
  } catch {
    await prisma.libraryDocument.update({
      where: { id: libraryDocumentId },
      data: { extractionStatus: "FAILED" }
    });
  }
}
