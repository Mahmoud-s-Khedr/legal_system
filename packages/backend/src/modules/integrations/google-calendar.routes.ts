import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requireEditionFeature } from "../../middleware/requireEditionFeature.js";
import type { AppEnv } from "../../config/env.js";
import {
  buildAuthUrl,
  handleOAuthCallback,
  revokeCalendarAccess,
  getConnectionStatus
} from "./googleCalendar.service.js";

export async function registerGoogleCalendarRoutes(app: FastifyInstance, env: AppEnv) {
  // ── OAuth initiation ──────────────────────────────────────────────────────────

  app.get(
    "/api/integrations/google-calendar/auth",
    {
      preHandler: [requireAuth, requireEditionFeature("google_calendar_sync")]
    },
    async (request, reply) => {
      if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_REDIRECT_URI) {
        return reply.status(503).send({ error: "Google Calendar integration is not configured" });
      }

      const actor = request.sessionUser!;
      // State contains a signed user identifier so the callback can verify the session
      const state = Buffer.from(JSON.stringify({ userId: actor.id, firmId: actor.firmId })).toString("base64url");
      const url = buildAuthUrl(env, state);
      return reply.redirect(url);
    }
  );

  // ── OAuth callback ─────────────────────────────────────────────────────────────

  app.get(
    "/api/integrations/google-calendar/callback",
    async (request, reply) => {
      const q = request.query as Record<string, string>;
      if (q.error) {
        return reply.redirect(`/app/settings?calendarError=${encodeURIComponent(q.error)}`);
      }

      if (!q.code || !q.state) {
        return reply.status(400).send({ error: "Missing code or state" });
      }

      let userId: string;
      let firmId: string;
      try {
        const decoded = JSON.parse(Buffer.from(q.state, "base64url").toString()) as { userId: string; firmId: string };
        userId = decoded.userId;
        firmId = decoded.firmId;
      } catch {
        return reply.status(400).send({ error: "Invalid state parameter" });
      }

      try {
        await handleOAuthCallback(q.code, userId, firmId, env);
        return reply.redirect("/app/settings?calendarConnected=1");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        return reply.redirect(`/app/settings?calendarError=${encodeURIComponent(msg)}`);
      }
    }
  );

  // ── Status ──────────────────────────────────────────────────────────────────

  app.get(
    "/api/integrations/google-calendar/status",
    {
      preHandler: [requireAuth, requireEditionFeature("google_calendar_sync")]
    },
    async (request) => getConnectionStatus(request.sessionUser!.id)
  );

  // ── Revoke ──────────────────────────────────────────────────────────────────

  app.delete(
    "/api/integrations/google-calendar/revoke",
    {
      preHandler: [requireAuth, requireEditionFeature("google_calendar_sync")]
    },
    async (request, reply) => {
      await revokeCalendarAccess(request.sessionUser!.id, env);
      return reply.send({ success: true });
    }
  );
}
