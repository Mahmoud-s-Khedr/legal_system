import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import {
  previewClientImport,
  executeClientImport,
  previewCaseImport,
  executeCaseImport,
  executeCaseImportPreview,
  executeClientImportPreview,
  listImportPreviewRows
} from "./import.service.js";

const ALLOWED_IMPORT_TYPES = [
  "text/csv",
  "application/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
];

export async function registerImportRoutes(app: FastifyInstance) {
  app.get(
    "/api/import/previews/:previewId/rows",
    { preHandler: [requireAuth] },
    async (request, reply) => {
      const query = request.query as {
        q?: string;
        status?: "valid" | "invalid";
        sortBy?: string;
        sortDir?: "asc" | "desc";
        page?: string;
        limit?: string;
      };
      const page = Math.max(1, Number.parseInt(query.page ?? "1", 10) || 1);
      const limit = Math.min(200, Math.max(1, Number.parseInt(query.limit ?? "50", 10) || 50));
      const result = listImportPreviewRows(
        request.sessionUser!,
        (request.params as { previewId: string }).previewId,
        {
          q: query.q,
          status: query.status,
          sortBy: query.sortBy,
          sortDir: query.sortDir,
          page,
          limit
        }
      );
      if (!result) {
        return reply.status(404).send({ message: "Import preview session not found or expired" });
      }
      return result;
    }
  );

  // ── Client import ────────────────────────────────────────────────────────────

  app.post(
    "/api/import/clients/preview",
    { preHandler: [requireAuth, requirePermission("clients:create")] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ message: "No file uploaded" });

      const mimeType = data.mimetype;
      if (!ALLOWED_IMPORT_TYPES.includes(mimeType)) {
        return reply.status(422).send({ message: "File must be CSV or Excel (.xlsx)" });
      }

      const result = await previewClientImport(data.file, mimeType, request.sessionUser!);
      return result;
    }
  );

  app.post(
    "/api/import/clients/execute",
    { preHandler: [requireAuth, requirePermission("clients:create")] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ message: "No file uploaded" });

      const mimeType = data.mimetype;
      if (!ALLOWED_IMPORT_TYPES.includes(mimeType)) {
        return reply.status(422).send({ message: "File must be CSV or Excel (.xlsx)" });
      }

      const result = await executeClientImport(
        data.file,
        mimeType,
        request.sessionUser!,
        { ipAddress: request.ip, userAgent: request.headers["user-agent"] }
      );
      return reply.status(200).send(result);
    }
  );

  app.post(
    "/api/import/clients/execute-preview",
    { preHandler: [requireAuth, requirePermission("clients:create")] },
    async (request, reply) => {
      const body = request.body as { previewId?: string };
      if (!body.previewId) {
        return reply.status(422).send({ message: "previewId is required" });
      }

      const result = await executeClientImportPreview(
        request.sessionUser!,
        body.previewId,
        { ipAddress: request.ip, userAgent: request.headers["user-agent"] }
      );
      if (!result) {
        return reply.status(404).send({ message: "Import preview session not found or expired" });
      }
      return reply.status(200).send(result);
    }
  );

  // ── Case import ──────────────────────────────────────────────────────────────

  app.post(
    "/api/import/cases/preview",
    { preHandler: [requireAuth, requirePermission("cases:create")] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ message: "No file uploaded" });

      const mimeType = data.mimetype;
      if (!ALLOWED_IMPORT_TYPES.includes(mimeType)) {
        return reply.status(422).send({ message: "File must be CSV or Excel (.xlsx)" });
      }

      const result = await previewCaseImport(data.file, mimeType, request.sessionUser!);
      return result;
    }
  );

  app.post(
    "/api/import/cases/execute",
    { preHandler: [requireAuth, requirePermission("cases:create")] },
    async (request, reply) => {
      const data = await request.file();
      if (!data) return reply.status(400).send({ message: "No file uploaded" });

      const mimeType = data.mimetype;
      if (!ALLOWED_IMPORT_TYPES.includes(mimeType)) {
        return reply.status(422).send({ message: "File must be CSV or Excel (.xlsx)" });
      }

      const result = await executeCaseImport(
        data.file,
        mimeType,
        request.sessionUser!,
        { ipAddress: request.ip, userAgent: request.headers["user-agent"] }
      );
      return reply.status(200).send(result);
    }
  );

  app.post(
    "/api/import/cases/execute-preview",
    { preHandler: [requireAuth, requirePermission("cases:create")] },
    async (request, reply) => {
      const body = request.body as { previewId?: string };
      if (!body.previewId) {
        return reply.status(422).send({ message: "previewId is required" });
      }

      const result = await executeCaseImportPreview(
        request.sessionUser!,
        body.previewId,
        { ipAddress: request.ip, userAgent: request.headers["user-agent"] }
      );
      if (!result) {
        return reply.status(404).send({ message: "Import preview session not found or expired" });
      }
      return reply.status(200).send(result);
    }
  );
}
