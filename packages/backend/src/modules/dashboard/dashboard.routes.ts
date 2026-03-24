import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getDashboardSummary } from "./dashboard.service.js";

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get(
    "/api/dashboard/summary",
    {
      preHandler: [requireAuth, requirePermission("dashboard:read")]
    },
    async (request) => getDashboardSummary(request.sessionUser!)
  );
}
