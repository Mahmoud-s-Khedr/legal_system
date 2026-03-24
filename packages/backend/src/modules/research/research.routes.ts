import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { requireEditionFeature } from "../../middleware/requireEditionFeature.js";
import {
  createSession,
  listSessions,
  getSession,
  deleteSession,
  sendMessage,
  checkUsageLimit
} from "./research.service.js";

export async function registerResearchRoutes(app: FastifyInstance) {
  // ── Sessions ─────────────────────────────────────────────────────────────

  app.get(
    "/api/research/sessions",
    {
      preHandler: [
        requireAuth,
        requirePermission("research:use"),
        requireEditionFeature("ai_research")
      ]
    },
    async (request) => listSessions(request.sessionUser!)
  );

  app.post(
    "/api/research/sessions",
    {
      preHandler: [
        requireAuth,
        requirePermission("research:use"),
        requireEditionFeature("ai_research")
      ]
    },
    async (request, reply) => {
      const body = request.body as { caseId?: string; title?: string };
      const result = await createSession(request.sessionUser!, body.caseId, body.title);
      return reply.status(201).send(result);
    }
  );

  app.get(
    "/api/research/sessions/:sessionId",
    {
      preHandler: [
        requireAuth,
        requirePermission("research:use"),
        requireEditionFeature("ai_research")
      ]
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const result = await getSession(request.sessionUser!, sessionId);
      if (!result) return reply.status(404).send({ error: "Session not found" });
      return result;
    }
  );

  app.delete(
    "/api/research/sessions/:sessionId",
    {
      preHandler: [
        requireAuth,
        requirePermission("research:use"),
        requireEditionFeature("ai_research")
      ]
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const ok = await deleteSession(request.sessionUser!, sessionId);
      if (!ok) return reply.status(404).send({ error: "Session not found" });
      return { success: true };
    }
  );

  // ── Usage ─────────────────────────────────────────────────────────────────

  app.get(
    "/api/research/usage",
    {
      preHandler: [
        requireAuth,
        requirePermission("research:use"),
        requireEditionFeature("ai_research")
      ]
    },
    async (request) => checkUsageLimit(request.sessionUser!.firmId)
  );

  // ── Streaming message (SSE) ───────────────────────────────────────────────

  app.post(
    "/api/research/sessions/:sessionId/messages",
    {
      preHandler: [
        requireAuth,
        requirePermission("research:use"),
        requireEditionFeature("ai_research")
      ]
    },
    async (request, reply) => {
      const { sessionId } = request.params as { sessionId: string };
      const { content } = request.body as { content: string };

      if (!content?.trim()) {
        return reply.status(400).send({ error: "content is required" });
      }

      // Set SSE headers
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      reply.raw.flushHeaders();

      try {
        const stream = sendMessage(request.sessionUser!, sessionId, content.trim());
        for await (const token of stream) {
          reply.raw.write(`data: ${JSON.stringify({ token })}\n\n`);
        }
        reply.raw.write("data: [DONE]\n\n");
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unknown error";
        if (message === "USAGE_LIMIT_EXCEEDED") {
          reply.raw.write(`data: ${JSON.stringify({ error: "USAGE_LIMIT_EXCEEDED" })}\n\n`);
        } else {
          reply.raw.write(`data: ${JSON.stringify({ error: message })}\n\n`);
        }
      } finally {
        reply.raw.end();
      }
    }
  );
}
