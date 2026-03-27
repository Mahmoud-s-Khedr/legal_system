import { randomUUID } from "node:crypto";
import path from "node:path";
import type {
  DocumentDto,
  DocumentDownloadDto,
  DocumentListResponseDto,
  DocumentVersionDto,
  SessionUser,
  UpdateDocumentDto,
  DocumentType as SharedDocumentType,
  ExtractionStatus as SharedExtractionStatus,
  OcrBackend as SharedOcrBackend
} from "@elms/shared";
import { ExtractionStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { dispatchExtraction } from "../../jobs/extractionDispatcher.js";
import type { IStorageAdapter } from "../../storage/IStorageAdapter.js";
import type { AppEnv } from "../../config/env.js";
import type { FastifyReply } from "fastify";
import { hasEditionFeature } from "../editions/editionPolicy.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";

export const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/tiff"
] as const;

function sanitizeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

function mapVersion(v: {
  id: string;
  documentId: string;
  versionNumber: number;
  fileName: string;
  storageKey: string;
  createdAt: Date;
}): DocumentVersionDto {
  return {
    id: v.id,
    documentId: v.documentId,
    versionNumber: v.versionNumber,
    fileName: v.fileName,
    storageKey: v.storageKey,
    createdAt: v.createdAt.toISOString()
  };
}

function mapDocument(doc: {
  id: string;
  firmId: string;
  caseId: string | null;
  clientId: string | null;
  uploadedById: string | null;
  title: string;
  fileName: string;
  mimeType: string;
  storageKey: string;
  type: string;
  extractionStatus: string;
  ocrBackend: string;
  contentText: string | null;
  createdAt: Date;
  updatedAt: Date;
  versions: Array<{
    id: string;
    documentId: string;
    versionNumber: number;
    fileName: string;
    storageKey: string;
    createdAt: Date;
  }>;
}): DocumentDto {
  return {
    id: doc.id,
    firmId: doc.firmId,
    caseId: doc.caseId,
    clientId: doc.clientId,
    uploadedById: doc.uploadedById,
    title: doc.title,
    fileName: doc.fileName,
    mimeType: doc.mimeType,
    storageKey: doc.storageKey,
    type: doc.type as SharedDocumentType,
    extractionStatus: doc.extractionStatus as SharedExtractionStatus,
    ocrBackend: doc.ocrBackend as SharedOcrBackend,
    contentText: doc.contentText,
    versions: doc.versions.map(mapVersion),
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString()
  };
}

export async function listDocuments(
  actor: SessionUser,
  filters: {
    q?: string;
    caseId?: string;
    clientId?: string;
    type?: string;
    sortBy?: string;
    sortDir?: SortDir;
  },
  pagination: { page: number; limit: number }
): Promise<DocumentListResponseDto> {
  const { page, limit } = pagination;
  const q = filters.q?.trim();
  const sortBy = normalizeSort(
    filters.sortBy,
    ["createdAt", "updatedAt", "title", "fileName", "type", "extractionStatus"] as const,
    "createdAt"
  );
  const sortDir = toPrismaSortOrder(filters.sortDir ?? "desc");

  return withTenant(prisma, actor.firmId, async (tx) => {
    const where = {
      firmId: actor.firmId,
      deletedAt: null,
      ...(filters.caseId ? { caseId: filters.caseId } : {}),
      ...(filters.clientId ? { clientId: filters.clientId } : {}),
      ...(filters.type ? { type: filters.type } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" as const } },
              { fileName: { contains: q, mode: "insensitive" as const } },
              { mimeType: { contains: q, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [total, docs] = await Promise.all([
      tx.document.count({ where }),
      tx.document.findMany({
        where,
        include: { versions: { orderBy: { versionNumber: "desc" } } },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return { items: docs.map(mapDocument), total, page, pageSize: limit };
  });
}

export async function getDocument(actor: SessionUser, documentId: string): Promise<DocumentDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const doc = await tx.document.findFirstOrThrow({
      where: { id: documentId, firmId: actor.firmId, deletedAt: null },
      include: { versions: { orderBy: { versionNumber: "desc" } } }
    });
    return mapDocument(doc);
  });
}

export interface UploadPayload {
  title: string;
  type: string;
  caseId?: string;
  clientId?: string;
  fileName: string;
  mimeType: string;
  stream: NodeJS.ReadableStream;
  fileSize?: number;
}

export async function createDocument(
  actor: SessionUser,
  payload: UploadPayload,
  env: AppEnv,
  storage: IStorageAdapter,
  audit: AuditContext
): Promise<DocumentDto> {
  if (!ALLOWED_MIME_TYPES.includes(payload.mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    const err = new Error(`Unsupported file type: ${payload.mimeType}`) as Error & { statusCode: number };
    err.statusCode = 422;
    throw err;
  }

  const safeFilename = sanitizeFilename(payload.fileName);
  const docId = randomUUID();
  const storageKey = `${actor.firmId}/${docId}/${safeFilename}`;

  // Write to storage first — if the DB transaction fails, we clean up the file
  await storage.put(storageKey, payload.stream, payload.mimeType);

  let doc;
  try {
    doc = await withTenant(prisma, actor.firmId, async (tx) => {
      const useGoogleVision =
        env.OCR_BACKEND === "google_vision" &&
        hasEditionFeature(actor.editionKey, "google_vision_ocr");

      const created = await tx.document.create({
        data: {
          id: docId,
          firmId: actor.firmId,
          caseId: payload.caseId ?? null,
          clientId: payload.clientId ?? null,
          uploadedById: actor.id,
          title: payload.title,
          fileName: safeFilename,
          mimeType: payload.mimeType,
          storageKey,
          type: payload.type,
          extractionStatus: ExtractionStatus.PENDING,
          ocrBackend: useGoogleVision ? "GOOGLE_VISION" : "TESSERACT"
        },
        include: { versions: { orderBy: { versionNumber: "desc" } } }
      });

      await tx.documentVersion.create({
        data: {
          documentId: docId,
          versionNumber: 1,
          fileName: safeFilename,
          storageKey
        }
      });

      await writeAuditLog(tx, audit, {
        action: "documents.create",
        entityType: "Document",
        entityId: docId,
        newData: { title: payload.title, caseId: payload.caseId ?? null }
      });

      return created;
    });
  } catch (err) {
    await storage.delete(storageKey).catch(() => {});
    throw err;
  }

  await dispatchExtraction(docId, actor.firmId, env, storage);

  return mapDocument({ ...doc, versions: [{ id: randomUUID(), documentId: docId, versionNumber: 1, fileName: safeFilename, storageKey, createdAt: doc.createdAt }] });
}

export async function updateDocument(
  actor: SessionUser,
  documentId: string,
  payload: UpdateDocumentDto,
  audit: AuditContext
): Promise<DocumentDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.document.findFirstOrThrow({
      where: { id: documentId, firmId: actor.firmId, deletedAt: null }
    });

    const updated = await tx.document.update({
      where: { id: documentId },
      data: {
        ...(payload.title !== undefined ? { title: payload.title } : {}),
        ...(payload.type !== undefined ? { type: payload.type } : {}),
        ...(payload.caseId !== undefined
          ? payload.caseId === null
            ? { case: { disconnect: true } }
            : { case: { connect: { id: payload.caseId } } }
          : {}),
        ...(payload.clientId !== undefined
          ? payload.clientId === null
            ? { client: { disconnect: true } }
            : { client: { connect: { id: payload.clientId } } }
          : {})
      },
      include: { versions: { orderBy: { versionNumber: "desc" } } }
    });

    await writeAuditLog(tx, audit, {
      action: "documents.update",
      entityType: "Document",
      entityId: documentId,
      oldData: { title: existing.title },
      newData: { title: updated.title }
    });

    return mapDocument(updated);
  });
}

export async function uploadNewVersion(
  actor: SessionUser,
  documentId: string,
  payload: Omit<UploadPayload, "title" | "type" | "caseId" | "clientId">,
  env: AppEnv,
  storage: IStorageAdapter,
  audit: AuditContext
): Promise<DocumentDto> {
  if (!ALLOWED_MIME_TYPES.includes(payload.mimeType as (typeof ALLOWED_MIME_TYPES)[number])) {
    const err = new Error(`Unsupported file type: ${payload.mimeType}`) as Error & { statusCode: number };
    err.statusCode = 422;
    throw err;
  }

  const safeFilename = sanitizeFilename(payload.fileName);

  // Determine the next version number before touching storage
  const existing = await withTenant(prisma, actor.firmId, (tx) =>
    tx.document.findFirstOrThrow({
      where: { id: documentId, firmId: actor.firmId, deletedAt: null },
      include: { versions: { orderBy: { versionNumber: "desc" }, take: 1 } }
    })
  );

  const nextVersion = (existing.versions[0]?.versionNumber ?? 0) + 1;
  const newStorageKey = `${actor.firmId}/${documentId}/v${nextVersion}-${safeFilename}`;

  // Write to storage first — if the DB transaction fails, we clean up the file
  await storage.put(newStorageKey, payload.stream, payload.mimeType);

  let updatedDoc;
  try {
    updatedDoc = await withTenant(prisma, actor.firmId, async (tx) => {
      await tx.documentVersion.create({
        data: {
          documentId,
          versionNumber: nextVersion,
          fileName: safeFilename,
          storageKey: newStorageKey
        }
      });

      const updated = await tx.document.update({
        where: { id: documentId },
        data: {
          fileName: safeFilename,
          storageKey: newStorageKey,
          extractionStatus: ExtractionStatus.PENDING,
          contentText: null
        },
        include: { versions: { orderBy: { versionNumber: "desc" } } }
      });

      await writeAuditLog(tx, audit, {
        action: "documents.version",
        entityType: "Document",
        entityId: documentId,
        newData: { version: nextVersion, fileName: safeFilename }
      });

      return updated;
    });
  } catch (err) {
    await storage.delete(newStorageKey).catch(() => {});
    throw err;
  }

  await dispatchExtraction(documentId, actor.firmId, env, storage);

  return mapDocument(updatedDoc);
}

export async function getDownloadUrl(
  actor: SessionUser,
  documentId: string,
  storage: IStorageAdapter
): Promise<DocumentDownloadDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const doc = await tx.document.findFirstOrThrow({
      where: { id: documentId, firmId: actor.firmId, deletedAt: null }
    });

    if (storage.supportsSignedUrls) {
      const url = await storage.getSignedUrl(doc.storageKey, 900); // 15 minutes
      const expiresAt = new Date(Date.now() + 900_000).toISOString();
      return { url, expiresAt };
    }

    return { url: `/api/documents/${documentId}/stream`, expiresAt: null };
  });
}

export async function streamDocument(
  actor: SessionUser,
  documentId: string,
  storage: IStorageAdapter,
  reply: FastifyReply
): Promise<void> {
  const doc = await withTenant(prisma, actor.firmId, async (tx) =>
    tx.document.findFirstOrThrow({
      where: { id: documentId, firmId: actor.firmId, deletedAt: null }
    })
  );

  const stream = await storage.get(doc.storageKey);
  const safeFilename = encodeURIComponent(doc.fileName);
  reply.header("Content-Type", doc.mimeType);
  reply.header("Content-Disposition", `attachment; filename="${safeFilename}"`);
  await reply.send(stream);
}

export async function softDeleteDocument(
  actor: SessionUser,
  documentId: string,
  audit: AuditContext
): Promise<{ success: true }> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.document.findFirstOrThrow({
      where: { id: documentId, firmId: actor.firmId, deletedAt: null }
    });

    await tx.document.update({
      where: { id: documentId },
      data: { deletedAt: new Date() }
    });

    await writeAuditLog(tx, audit, {
      action: "documents.delete",
      entityType: "Document",
      entityId: documentId,
      oldData: { title: existing.title }
    });

    return { success: true as const };
  });
}
