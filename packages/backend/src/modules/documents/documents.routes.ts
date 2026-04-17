import { Readable } from "node:stream";
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { fileTypeFromBuffer } from "file-type";
import { DocumentType } from "@elms/shared";
import { documentDtoSchema, listResponseSchema, successSchema } from "../../schemas/index.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import { readUploadBuffer } from "../../utils/upload.js";
import type { AppEnv } from "../../config/env.js";
import {
  ALLOWED_MIME_TYPES,
  createDocument,
  getDocument,
  getDownloadUrl,
  listDocuments,
  softDeleteDocument,
  streamDocument,
  updateDocument,
  uploadNewVersion
} from "./documents.service.js";

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.nativeEnum(DocumentType).optional(),
  caseId: z.string().uuid().nullable().optional(),
  clientId: z.string().uuid().nullable().optional()
});

const listDocumentsQuerySchema = z.object({
  q: z.string().optional(),
  search: z.string().optional(),
  caseId: z.string().uuid().optional(),
  clientId: z.string().uuid().optional(),
  type: z.string().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

export async function registerDocumentRoutes(app: FastifyInstance, env: AppEnv) {
  // List documents (with optional filters)
  app.get(
    "/api/documents",
    { schema: { response: { 200: listResponseSchema(documentDtoSchema) } }, preHandler: [requireAuth, requirePermission("documents:read")] },
    async (request) => {
      const query = listDocumentsQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(query);
      return listDocuments(
        request.sessionUser!,
        {
          q: query.q ?? query.search,
          caseId: query.caseId,
          clientId: query.clientId,
          type: query.type,
          sortBy: query.sortBy,
          sortDir: query.sortDir
        },
        { page, limit }
      );
    }
  );

  // Upload a new document (multipart)
  app.post(
    "/api/documents",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const actor = request.sessionUser!;
      if (!actor.permissions.includes("documents:create")) {
        return reply.status(403).send({ message: "Forbidden" });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ message: "No file uploaded" });
      }

      // Validate MIME type using file byte inspection (not the spoofable Content-Type header)
      const fileBuffer = await readUploadBuffer(data.file);
      const detectedMime = (await fileTypeFromBuffer(fileBuffer))?.mime ?? null;
      if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime as (typeof ALLOWED_MIME_TYPES)[number])) {
        return reply.status(422).send({ message: `Unsupported or undetectable file type` });
      }

      const fields = data.fields as Record<string, { value: string }>;
      const title = fields.title?.value ?? data.filename;
      const type = fields.type?.value ?? DocumentType.GENERAL;
      const caseId = fields.caseId?.value || undefined;
      const clientId = fields.clientId?.value || undefined;

      // Validate type field
      if (!Object.values(DocumentType).includes(type as DocumentType)) {
        return reply.status(422).send({ message: `Invalid document type: ${type}` });
      }

      const doc = await createDocument(
        actor,
        {
          title,
          type,
          caseId,
          clientId,
          fileName: data.filename,
          mimeType: detectedMime,
          stream: Readable.from(fileBuffer)
        },
        env,
        app.storage,
        getAuditContext(request)
      );

      return reply.status(201).send(doc);
    }
  );

  // Get a single document
  app.get(
    "/api/documents/:id",
    { schema: { response: { 200: documentDtoSchema } }, preHandler: [requireAuth, requirePermission("documents:read")] },
    async (request) =>
      getDocument(request.sessionUser!, (request.params as { id: string }).id)
  );

  // Update document metadata
  app.put(
    "/api/documents/:id",
    { schema: { response: { 200: documentDtoSchema } }, preHandler: [requireAuth, requirePermission("documents:update")] },
    async (request) => {
      const payload = updateDocumentSchema.parse(request.body);
      return updateDocument(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  // Soft-delete document
  app.delete(
    "/api/documents/:id",
    { schema: { response: { 200: successSchema } }, preHandler: [requireAuth, requirePermission("documents:delete")] },
    async (request) =>
      softDeleteDocument(
        request.sessionUser!,
        (request.params as { id: string }).id,
        getAuditContext(request)
      )
  );

  // Get download URL (redirect for cloud, URL for local)
  app.get(
    "/api/documents/:id/download",
    { preHandler: [requireAuth, requirePermission("documents:read")] },
    async (request) =>
      getDownloadUrl(
        request.sessionUser!,
        (request.params as { id: string }).id,
        app.storage
      )
  );

  // Stream document bytes (local mode)
  app.get(
    "/api/documents/:id/stream",
    { preHandler: [requireAuth, requirePermission("documents:read")] },
    async (request, reply) =>
      streamDocument(
        request.sessionUser!,
        (request.params as { id: string }).id,
        app.storage,
        reply
      )
  );

  // Upload a new version of an existing document (multipart)
  app.post(
    "/api/documents/:id/versions",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const actor = request.sessionUser!;
      if (!actor.permissions.includes("documents:create")) {
        return reply.status(403).send({ message: "Forbidden" });
      }

      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ message: "No file uploaded" });
      }

      // Validate MIME type using file byte inspection (not the spoofable Content-Type header)
      const fileBuffer = await readUploadBuffer(data.file);
      const detectedMime = (await fileTypeFromBuffer(fileBuffer))?.mime ?? null;
      if (!detectedMime || !ALLOWED_MIME_TYPES.includes(detectedMime as (typeof ALLOWED_MIME_TYPES)[number])) {
        return reply.status(422).send({ message: `Unsupported or undetectable file type` });
      }

      const doc = await uploadNewVersion(
        actor,
        (request.params as { id: string }).id,
        {
          fileName: data.filename,
          mimeType: detectedMime,
          stream: Readable.from(fileBuffer)
        },
        env,
        app.storage,
        getAuditContext(request)
      );

      return reply.status(201).send(doc);
    }
  );
}
