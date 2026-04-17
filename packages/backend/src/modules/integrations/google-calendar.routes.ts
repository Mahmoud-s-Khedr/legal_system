import { createHmac, timingSafeEqual } from "node:crypto";
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

const OAUTH_STATE_TTL_SECONDS = 10 * 60;

type OAuthStatePayload = {
  userId: string;
  firmId: string;
  exp: number;
};

function signOAuthStatePayload(encodedPayload: string, env: AppEnv): string {
  const secret = env.GOOGLE_OAUTH_CLIENT_SECRET;
  if (!secret) {
    throw new Error("Google Calendar integration is not configured");
  }
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

function encodeOAuthState(userId: string, firmId: string, env: AppEnv): string {
  const payload: OAuthStatePayload = {
    userId,
    firmId,
    exp: Math.floor(Date.now() / 1000) + OAUTH_STATE_TTL_SECONDS
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = signOAuthStatePayload(encodedPayload, env);
  return `${encodedPayload}.${signature}`;
}

function decodeOAuthState(state: string, env: AppEnv): OAuthStatePayload {
  const [encodedPayload, providedSignature] = state.split(".");
  if (!encodedPayload || !providedSignature) {
    throw new Error("Invalid state parameter");
  }

  const expectedSignature = signOAuthStatePayload(encodedPayload, env);
  const providedSignatureBuffer = Buffer.from(providedSignature);
  const expectedSignatureBuffer = Buffer.from(expectedSignature);

  if (
    providedSignatureBuffer.length !== expectedSignatureBuffer.length ||
    !timingSafeEqual(providedSignatureBuffer, expectedSignatureBuffer)
  ) {
    throw new Error("Invalid state signature");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString()) as OAuthStatePayload;
  if (!payload.userId || !payload.firmId || typeof payload.exp !== "number") {
    throw new Error("Invalid state payload");
  }
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error("State expired");
  }

  return payload;
}

export async function registerGoogleCalendarRoutes(app: FastifyInstance, env: AppEnv) {
  // ── OAuth initiation ──────────────────────────────────────────────────────────

  app.get(
    "/api/integrations/google-calendar/auth",
    {
      preHandler: [requireAuth, requireEditionFeature("google_calendar_sync")]
    },
    async (request, reply) => {
      if (!env.GOOGLE_OAUTH_CLIENT_ID || !env.GOOGLE_OAUTH_REDIRECT_URI || !env.GOOGLE_OAUTH_CLIENT_SECRET) {
        return reply.status(503).send({ error: "Google Calendar integration is not configured" });
      }

      const actor = request.sessionUser!;
      const state = encodeOAuthState(actor.id, actor.firmId, env);
      const url = buildAuthUrl(env, state);
      return reply.redirect(url);
    }
  );

  // ── OAuth callback ─────────────────────────────────────────────────────────────

  app.get(
    "/api/integrations/google-calendar/callback",
    async (request, reply) => {
      if (!env.GOOGLE_OAUTH_CLIENT_SECRET) {
        return reply.status(503).send({ error: "Google Calendar integration is not configured" });
      }

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
        const decoded = decodeOAuthState(q.state, env);
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
