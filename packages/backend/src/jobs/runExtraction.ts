import { prisma } from "../db/prisma.js";
import { normalizeArabic } from "../utils/arabic.js";
import { TesseractAdapter } from "../modules/documents/ocr/TesseractAdapter.js";
import { GoogleVisionAdapter } from "../modules/documents/ocr/GoogleVisionAdapter.js";
import type { IStorageAdapter } from "../storage/IStorageAdapter.js";
import type { AppEnv } from "../config/env.js";
import { dispatchNotification } from "../modules/notifications/notification.service.js";
import { NotificationType } from "@elms/shared";
import { captureBackendException } from "../monitoring/sentry.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";
const DEFAULT_MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

async function streamToBufferWithLimit(
  stream: NodeJS.ReadableStream,
  maxBytes: number
): Promise<Buffer> {
  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of stream) {
    const chunkBuffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array);
    totalBytes += chunkBuffer.length;
    if (totalBytes > maxBytes) {
      throw new Error(`Document exceeds extraction memory limit (${maxBytes} bytes)`);
    }
    chunks.push(chunkBuffer);
  }
  return Buffer.concat(chunks);
}

function resolveExtractionBufferLimitBytes(env: AppEnv, mimeType: string): number {
  const maxUploadBytes = Number.isFinite(env.MAX_UPLOAD_BYTES)
    ? env.MAX_UPLOAD_BYTES
    : DEFAULT_MAX_UPLOAD_BYTES;

  if (mimeType === PDF_MIME || mimeType === DOCX_MIME) {
    return maxUploadBytes;
  }

  return Math.min(maxUploadBytes, env.OCR_EMBEDDED_IMAGE_MAX_BYTES);
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
    const maxBufferBytes = resolveExtractionBufferLimitBytes(env, doc.mimeType);
    const buffer = await streamToBufferWithLimit(stream, maxBufferBytes);

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
      try {
        await dispatchNotification(env, doc.firmId, doc.uploadedById, NotificationType.DOCUMENT_INDEXED, {
          documentTitle: doc.title
        }, {
          entityType: "Document",
          entityId: doc.id
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn("[extraction] notification dispatch failed", {
          documentId,
          uploaderId: doc.uploadedById,
          errorMessage: message
        });
      }
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[extraction] runExtraction failed", {
      documentId,
      errorMessage: message
    });
    captureBackendException(error);

    await prisma.document.update({
      where: { id: documentId },
      data: { extractionStatus: "FAILED" }
    });
  }
}
