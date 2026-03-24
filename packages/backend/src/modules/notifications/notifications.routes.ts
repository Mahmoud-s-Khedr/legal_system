import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { NotificationChannel, NotificationType } from "@elms/shared";
import { requireAuth } from "../../middleware/requireAuth.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import {
  listResponseSchema,
  notificationDtoSchema,
  notificationPreferenceDtoSchema,
  successSchema
} from "../../schemas/index.js";
import {
  listNotifications,
  listPreferences,
  markAllRead,
  markRead,
  upsertPreference,
  getUnreadCount
} from "./notification.service.js";

export async function registerNotificationRoutes(app: FastifyInstance) {
  app.get(
    "/api/notifications",
    {
      schema: { response: { 200: listResponseSchema(notificationDtoSchema) } },
      preHandler: [requireAuth]
    },
    async (request) => {
      const filters = request.query as Record<string, string>;
      const { page, limit } = parsePaginationQuery(filters);
      return listNotifications(request.sessionUser!, { page, limit });
    }
  );

  app.get(
    "/api/notifications/unread-count",
    {
      schema: {
        response: {
          200: { type: "object", properties: { count: { type: "number" } }, required: ["count"], additionalProperties: false }
        }
      },
      preHandler: [requireAuth]
    },
    async (request) => ({ count: await getUnreadCount(request.sessionUser!) })
  );

  app.patch(
    "/api/notifications/:id/read",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth]
    },
    async (request) => {
      await markRead(request.sessionUser!, (request.params as { id: string }).id);
      return { success: true as const };
    }
  );

  app.patch(
    "/api/notifications/read-all",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth]
    },
    async (request) => {
      await markAllRead(request.sessionUser!);
      return { success: true as const };
    }
  );

  // ── Preferences ─────────────────────────────────────────────────────────────

  app.get(
    "/api/notifications/preferences",
    {
      schema: { response: { 200: { type: "array", items: notificationPreferenceDtoSchema } } },
      preHandler: [requireAuth]
    },
    async (request) => listPreferences(request.sessionUser!)
  );

  app.put(
    "/api/notifications/preferences",
    {
      schema: { response: { 200: notificationPreferenceDtoSchema } },
      preHandler: [requireAuth]
    },
    async (request) => {
      const schema = z.object({
        type: z.nativeEnum(NotificationType),
        channel: z.nativeEnum(NotificationChannel),
        enabled: z.boolean()
      });
      const dto = schema.parse(request.body);
      return upsertPreference(request.sessionUser!, dto);
    }
  );
}
