import { prisma } from "../db/prisma.js";
import { normalizeArabic } from "../utils/arabic.js";
import { TesseractAdapter } from "../modules/documents/ocr/TesseractAdapter.js";
import { GoogleVisionAdapter } from "../modules/documents/ocr/GoogleVisionAdapter.js";
import type { IStorageAdapter } from "../storage/IStorageAdapter.js";
import type { AppEnv } from "../config/env.js";
import { dispatchNotification } from "../modules/notifications/notification.service.js";
import { NotificationType } from "@elms/shared";

async function streamToBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array));
  }
  return Buffer.concat(chunks);
}

export async function runExtraction(
  documentId: string,
  env: AppEnv,
  storage: IStorageAdapter
): Promise<void> {
  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.deletedAt) return;

  await prisma.document.update({
    where: { id: documentId },
    data: { extractionStatus: "PROCESSING" }
  });

  try {
    const stream = await storage.get(doc.storageKey);
    const buffer = await streamToBuffer(stream);

    const adapter =
      doc.ocrBackend === "GOOGLE_VISION"
        ? new GoogleVisionAdapter(env)
        : new TesseractAdapter(env);

    const rawText = await adapter.extract(buffer, doc.mimeType, {
      documentId,
      source: "documents",
    });
    const contentText = normalizeArabic(rawText);

    await prisma.document.update({
      where: { id: documentId },
      data: { contentText, extractionStatus: "INDEXED" }
    });

    // Notify the uploader that their document is now searchable
    if (doc.uploadedById && doc.firmId) {
      await dispatchNotification(env, doc.firmId, doc.uploadedById, NotificationType.DOCUMENT_INDEXED, {
        documentTitle: doc.title
      }, {
        entityType: "Document",
        entityId: doc.id
      }).catch(() => {}); // notifications are best-effort
    }
  } catch {
    await prisma.document.update({
      where: { id: documentId },
      data: { extractionStatus: "FAILED" }
    });
  }
}
