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

function getMimeTypeFromStorageKey(storageKey: string): string {
  const ext = storageKey.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "pdf") return "application/pdf";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "png") return "image/png";
  if (ext === "tif" || ext === "tiff") return "image/tiff";
  if (ext === "webp") return "image/webp";
  if (ext === "bmp") return "image/bmp";
  if (ext === "gif") return "image/gif";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "image/jpeg";
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
    const mimeType = getMimeTypeFromStorageKey(doc.storageKey);

    const adapter =
      doc.ocrBackend === "GOOGLE_VISION"
        ? new GoogleVisionAdapter(env)
        : new TesseractAdapter(env);

    const rawText = await adapter.extract(buffer, mimeType, {
      documentId: libraryDocumentId,
      source: "library",
    });
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
