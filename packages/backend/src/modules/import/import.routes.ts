import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import {
  previewClientImport,
  executeClientImport,
  previewCaseImport,
  executeCaseImport
} from "./import.service.js";

const ALLOWED_IMPORT_TYPES = [
  "text/csv",
  "application/csv",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel"
];

export async function registerImportRoutes(app: FastifyInstance) {
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

      const result = await previewClientImport(data.file, mimeType);
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

      const result = await previewCaseImport(data.file, mimeType);
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
}
