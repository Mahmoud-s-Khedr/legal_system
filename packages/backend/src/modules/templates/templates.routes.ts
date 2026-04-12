import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getAuditContext } from "../../utils/auditContext.js";
import {
  createTemplate,
  deleteTemplate,
  exportTemplateDocx,
  getTemplate,
  listTemplates,
  renderTemplate,
  updateTemplate
} from "./templates.service.js";

const createTemplateSchema = z.object({
  name: z.string().min(1),
  language: z.string().optional(),
  body: z.string().min(1)
});

const updateTemplateSchema = z.object({
  name: z.string().min(1).optional(),
  language: z.string().optional(),
  body: z.string().min(1).optional()
});

export async function registerTemplateRoutes(app: FastifyInstance) {
  app.get(
    "/api/templates",
    { preHandler: [requireAuth, requirePermission("templates:read")] },
    async (request) => {
      return listTemplates(request.sessionUser!);
    }
  );

  app.get(
    "/api/templates/:id",
    { preHandler: [requireAuth, requirePermission("templates:read")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const result = await getTemplate(request.sessionUser!, id);

      if (!result) {
        return reply.status(404).send({ error: "Template not found" });
      }

      return result;
    }
  );

  app.post(
    "/api/templates",
    { preHandler: [requireAuth, requirePermission("templates:create")] },
    async (request, reply) => {
      const body = createTemplateSchema.parse(request.body);
      const audit = getAuditContext(request);
      const result = await createTemplate(request.sessionUser!, body, audit);
      return reply.status(201).send(result);
    }
  );

  app.put(
    "/api/templates/:id",
    { preHandler: [requireAuth, requirePermission("templates:update")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateTemplateSchema.parse(request.body);
      const audit = getAuditContext(request);
      const result = await updateTemplate(request.sessionUser!, id, body, audit);

      if (!result) {
        return reply.status(404).send({ error: "Template not found or is a system template" });
      }

      return result;
    }
  );

  app.delete(
    "/api/templates/:id",
    { preHandler: [requireAuth, requirePermission("templates:delete")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const audit = getAuditContext(request);
      const deleted = await deleteTemplate(request.sessionUser!, id, audit);

      if (!deleted) {
        return reply.status(404).send({ error: "Template not found or is a system template" });
      }

      return reply.status(204).send();
    }
  );

  app.post(
    "/api/templates/:id/render",
    { preHandler: [requireAuth, requirePermission("templates:read")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { caseId } = z.object({ caseId: z.string().uuid() }).parse(request.body);

      const result = await renderTemplate(request.sessionUser!, id, caseId);

      if (!result) {
        return reply.status(404).send({ error: "Template or case not found" });
      }

      return result;
    }
  );

  app.post(
    "/api/templates/:id/export",
    { preHandler: [requireAuth, requirePermission("templates:read")] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const query = z
        .object({
          format: z.literal("docx").default("docx"),
          mode: z.enum(["template", "rendered"]).default("template")
        })
        .parse(request.query);
      const body = z.object({ caseId: z.string().uuid().optional() }).parse(request.body ?? {});

      if (query.mode === "rendered" && !body.caseId) {
        return reply.status(400).send({ error: "caseId is required for rendered export mode" });
      }

      const result = await exportTemplateDocx(request.sessionUser!, id, query.mode, body.caseId);
      if (!result) {
        return reply.status(404).send({ error: "Template or case not found" });
      }

      return reply
        .header("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        .header("Content-Disposition", `attachment; filename=\"${result.fileName}\"`)
        .send(result.buffer);
    }
  );
}
