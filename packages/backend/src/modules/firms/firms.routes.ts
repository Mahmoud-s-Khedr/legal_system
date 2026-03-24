import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getCurrentFirm, getCurrentFirmSubscription } from "./firms.service.js";

export async function registerFirmRoutes(app: FastifyInstance) {
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
}
