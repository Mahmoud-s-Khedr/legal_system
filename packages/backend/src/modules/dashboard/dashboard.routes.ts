import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getDashboard, getDashboardAnalytics } from "./dashboard.service.js";

const scopeSchema = z.object({
  scope: z.enum(["my", "team", "office"]).optional()
});

const analyticsSchema = scopeSchema.extend({
  range: z.enum(["30d", "90d"]).optional()
});

export async function registerDashboardRoutes(app: FastifyInstance) {
  app.get(
    "/api/dashboard",
    {
      preHandler: [requireAuth, requirePermission("dashboard:read")]
    },
    async (request) => {
      const query = scopeSchema.parse(request.query as Record<string, string>);
      return getDashboard(request.sessionUser!, query.scope ?? "my");
    }
  );

  app.get(
    "/api/dashboard/analytics",
    {
      preHandler: [requireAuth, requirePermission("dashboard:read")]
    },
    async (request) => {
      const query = analyticsSchema.parse(request.query as Record<string, string>);
      return getDashboardAnalytics(request.sessionUser!, query.scope ?? "my", query.range ?? "30d");
    }
  );
}
