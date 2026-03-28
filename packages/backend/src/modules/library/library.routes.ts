import { randomUUID } from "node:crypto";
import path from "node:path";
import { Readable } from "node:stream";
import type { FastifyInstance } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import type { AppEnv } from "../../config/env.js";
import { ALLOWED_MIME_TYPES } from "../documents/documents.service.js";
import { dispatchLibraryExtraction } from "../../jobs/libraryExtractionDispatcher.js";
import { prisma } from "../../db/prisma.js";
import {
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  listDocuments,
  getDocument,
  createDocument,
  updateDocument,
  softDeleteDocument,
  getArticle,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  listCaseLegalReferences,
  linkDocumentToCase,
  unlinkDocumentFromCase,
  searchLibrary
} from "./library.service.js";
import { hasEditionFeature } from "../editions/editionPolicy.js";

function sanitizeFilename(name: string): string {
  return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function readUploadBuffer(stream: NodeJS.ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function registerLibraryRoutes(app: FastifyInstance, env: AppEnv) {
  // ── Categories ──────────────────────────────────────────────────────────────

  app.get(
    "/api/library/categories",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request) => listCategories(request.sessionUser!)
  );

  app.post(
    "/api/library/categories",
    { preHandler: [requireAuth, requirePermission("library:manage")] },
    async (request, reply) => {
      const body = request.body as {
        nameAr: string;
        nameEn: string;
        nameFr: string;
        slug: string;
        parentId?: string;
      };
      const result = await createCategory(request.sessionUser!, body);
      return reply.status(201).send(result);
    }
  );

  app.put(
    "/api/library/categories/:categoryId",
    { preHandler: [requireAuth, requirePermission("library:manage")] },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      const body = request.body as {
        nameAr?: string;
        nameEn?: string;
        nameFr?: string;
        slug?: string;
        parentId?: string | null;
      };
      const result = await updateCategory(request.sessionUser!, categoryId, body);
      if (!result) return reply.status(404).send({ error: "Category not found" });
      return result;
    }
  );

  app.delete(
    "/api/library/categories/:categoryId",
    { preHandler: [requireAuth, requirePermission("library:manage")] },
    async (request, reply) => {
      const { categoryId } = request.params as { categoryId: string };
      const ok = await deleteCategory(request.sessionUser!, categoryId);
      if (!ok) return reply.status(404).send({ error: "Category not found" });
      return { success: true };
    }
  );

  // ── Documents ───────────────────────────────────────────────────────────────

  app.get(
    "/api/library/documents",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request) => {
      const q = request.query as Record<string, string>;
      return listDocuments(
        request.sessionUser!,
        { type: q.type, scope: q.scope, categoryId: q.categoryId, dateFrom: q.dateFrom, dateTo: q.dateTo, q: q.q },
        Number(q.page) || 1,
        Number(q.limit) || 20
      );
    }
  );

  app.get(
    "/api/library/documents/:documentId",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request, reply) => {
      const { documentId } = request.params as { documentId: string };
      const result = await getDocument(request.sessionUser!, documentId, request.sessionUser!.id);
      if (!result) return reply.status(404).send({ error: "Document not found" });
      return result;
    }
  );

  app.post(
    "/api/library/documents",
    { preHandler: [requireAuth, requirePermission("library:manage")] },
    async (request, reply) => {
      const body = request.body as Parameters<typeof createDocument>[1];
      const result = await createDocument(request.sessionUser!, body);
      return reply.status(201).send(result);
    }
  );

  app.put(
    "/api/library/documents/:documentId",
    { preHandler: [requireAuth, requirePermission("library:manage")] },
    async (request, reply) => {
      const { documentId } = request.params as { documentId: string };
      const body = request.body as Parameters<typeof updateDocument>[2];
      const result = await updateDocument(request.sessionUser!, documentId, body);
      if (!result) return reply.status(404).send({ error: "Document not found" });
      return result;
    }
  );

  app.delete(
    "/api/library/documents/:documentId",
    { preHandler: [requireAuth, requirePermission("library:manage")] },
    async (request, reply) => {
      const { documentId } = request.params as { documentId: string };
      const ok = await softDeleteDocument(request.sessionUser!, documentId);
      if (!ok) return reply.status(404).send({ error: "Document not found" });
      return { success: true };
    }
  );

  // ── Articles (permalink) ─────────────────────────────────────────────────────

  app.get(
    "/api/library/articles/:articleId",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request, reply) => {
      const { articleId } = request.params as { articleId: string };
      const result = await getArticle(request.sessionUser!, articleId);
      if (!result) return reply.status(404).send({ error: "Article not found" });
      return result;
    }
  );

  // ── Annotations ─────────────────────────────────────────────────────────────

  app.post(
    "/api/library/documents/:documentId/annotations",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request, reply) => {
      const { documentId } = request.params as { documentId: string };
      const { body } = request.body as { body: string };
      const result = await createAnnotation(request.sessionUser!, documentId, body);
      return reply.status(201).send(result);
    }
  );

  app.put(
    "/api/library/annotations/:annotationId",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request, reply) => {
      const { annotationId } = request.params as { annotationId: string };
      const { body } = request.body as { body: string };
      const result = await updateAnnotation(request.sessionUser!, annotationId, body);
      if (!result) return reply.status(404).send({ error: "Annotation not found" });
      return result;
    }
  );

  app.delete(
    "/api/library/annotations/:annotationId",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request, reply) => {
      const { annotationId } = request.params as { annotationId: string };
      const ok = await deleteAnnotation(request.sessionUser!, annotationId);
      if (!ok) return reply.status(404).send({ error: "Annotation not found" });
      return { success: true };
    }
  );

  // ── Case Legal References ───────────────────────────────────────────────────

  app.get(
    "/api/cases/:caseId/legal-references",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request) => {
      const { caseId } = request.params as { caseId: string };
      return listCaseLegalReferences(request.sessionUser!, caseId);
    }
  );

  app.post(
    "/api/cases/:caseId/legal-references",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request, reply) => {
      const { caseId } = request.params as { caseId: string };
      const body = request.body as { documentId: string; articleId?: string; notes?: string };
      const result = await linkDocumentToCase(request.sessionUser!, caseId, body.documentId, body.articleId, body.notes);
      return reply.status(201).send(result);
    }
  );

  app.delete(
    "/api/cases/legal-references/:referenceId",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request, reply) => {
      const { referenceId } = request.params as { referenceId: string };
      const ok = await unlinkDocumentFromCase(request.sessionUser!, referenceId);
      if (!ok) return reply.status(404).send({ error: "Reference not found" });
      return { success: true };
    }
  );

  // ── Search ──────────────────────────────────────────────────────────────────

  app.get(
    "/api/library/search",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request) => {
      const q = request.query as Record<string, string>;
      if (!q.q) return { results: [] };
      const results = await searchLibrary(
        request.sessionUser!,
        q.q,
        { type: q.type, scope: q.scope, categoryId: q.categoryId },
        Number(q.limit) || 20
      );
      return { results };
    }
  );

  // ── File Upload (ingestion) ──────────────────────────────────────────────────

  app.post(
    "/api/library/documents/upload",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request, reply) => {
      const actor = request.sessionUser!;

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ message: "No file uploaded" });
      }

      const fields = data.fields as Record<string, { value: string }>;
      const title    = fields.title?.value ?? data.filename;
      const type     = fields.type?.value ?? "LEGISLATION";
      const requestedScope = (fields.scope?.value ?? "FIRM") as "SYSTEM" | "FIRM";
      const canManageLibrary = actor.permissions.includes("library:manage");
      if (!canManageLibrary && requestedScope === "SYSTEM") {
        return reply.status(403).send({ message: "Only library managers can upload system library documents" });
      }
      const scope = canManageLibrary ? requestedScope : "FIRM";
      const categoryId   = fields.categoryId?.value || undefined;
      const lawNumber    = fields.lawNumber?.value || undefined;
      const lawYear      = fields.lawYear?.value ? Number(fields.lawYear.value) : undefined;
      const judgmentNumber = fields.judgmentNumber?.value || undefined;
      const judgmentDate   = fields.judgmentDate?.value || undefined;
      const author         = fields.author?.value || undefined;
      const publishedAt    = fields.publishedAt?.value || undefined;
      const legislationStatus = fields.legislationStatus?.value || undefined;

      // Validate MIME type using file byte inspection
      const fileBuffer = await readUploadBuffer(data.file);
      const detectedMime = (await fileTypeFromBuffer(fileBuffer))?.mime ?? null;
      if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime as (typeof ALLOWED_MIME_TYPES)[number])) {
        return reply.status(422).send({ message: "Unsupported or undetectable file type" });
      }

      const docId = randomUUID();
      const safeFilename = sanitizeFilename(data.filename);
      const storageKey = `library/${actor.firmId}/${docId}/${safeFilename}`;

      // Store file first, then create DB record
      await app.storage.put(storageKey, Readable.from(fileBuffer), detectedMime);

      let doc: { id: string };
      try {
        const useGoogleVision =
          env.OCR_BACKEND === "google_vision" &&
          hasEditionFeature(actor.editionKey, "google_vision_ocr");

        doc = await prisma.libraryDocument.create({
          data: {
            id: docId,
            firmId: scope === "SYSTEM" ? null : actor.firmId,
            scope,
            type,
            title,
            categoryId: categoryId ?? null,
            lawNumber: lawNumber ?? null,
            lawYear: lawYear ?? null,
            judgmentNumber: judgmentNumber ?? null,
            judgmentDate: judgmentDate ? new Date(judgmentDate) : null,
            author: author ?? null,
            publishedAt: publishedAt ? new Date(publishedAt) : null,
            legislationStatus: legislationStatus ? (legislationStatus as "ACTIVE" | "AMENDED" | "REPEALED") : null,
            storageKey,
            extractionStatus: "PENDING",
            ocrBackend: useGoogleVision ? "GOOGLE_VISION" : "TESSERACT"
          }
        });
      } catch (err) {
        await app.storage.delete(storageKey).catch(() => {});
        throw err;
      }

      await dispatchLibraryExtraction(doc.id, actor.firmId, env, app.storage);

      return reply.status(201).send({ id: doc.id, extractionStatus: "PENDING", storageKey });
    }
  );

  // ── Get file download URL for a library document ─────────────────────────────

  app.get(
    "/api/library/documents/:documentId/download",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request, reply) => {
      const { documentId } = request.params as { documentId: string };
      const doc = await prisma.libraryDocument.findFirst({
        where: { id: documentId, deletedAt: null }
      });
      if (!doc || !doc.storageKey) {
        return reply.status(404).send({ error: "File not found" });
      }
      if (app.storage.supportsSignedUrls) {
        const url = await app.storage.getSignedUrl(doc.storageKey, 900);
        return { url };
      }
      return reply.redirect(`/api/library/documents/${documentId}/stream`);
    }
  );

  app.get(
    "/api/library/documents/:documentId/stream",
    { preHandler: [requireAuth, requirePermission("library:read")] },
    async (request, reply) => {
      const { documentId } = request.params as { documentId: string };
      const doc = await prisma.libraryDocument.findFirst({
        where: { id: documentId, deletedAt: null }
      });
      if (!doc || !doc.storageKey) {
        return reply.status(404).send({ error: "File not found" });
      }
      const stream = await app.storage.get(doc.storageKey);
      return reply.send(stream);
    }
  );
}
