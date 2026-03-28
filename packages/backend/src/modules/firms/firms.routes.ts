import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { EditionKey } from "@elms/shared";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getCurrentFirm, getCurrentFirmSubscription, requestEditionChange } from "./firms.service.js";

export async function registerFirmRoutes(app: FastifyInstance) {
  const editionChangeSchema = z.object({
    editionKey: z.nativeEnum(EditionKey)
  });

  app.get(
    "/api/firms/me",
    {
      preHandler: [requireAuth, requirePermission("firms:read")]
    },
    async (request) => getCurrentFirm(request.sessionUser!)
  );

  app.get(
    "/api/firms/me/subscription",
    {
      preHandler: [requireAuth, requirePermission("firms:read")]
    },
    async (request) => getCurrentFirmSubscription(request.sessionUser!)
  );

  app.post(
    "/api/firms/me/edition-change-request",
    {
      preHandler: [requireAuth, requirePermission("firms:read")]
    },
    async (request) => requestEditionChange(request.sessionUser!, editionChangeSchema.parse(request.body))
  );
}
