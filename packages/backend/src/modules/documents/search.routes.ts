import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { parseSearchPaginationQuery } from "../../utils/pagination.js";
import { searchDocuments } from "./search.service.js";

export async function registerSearchRoutes(app: FastifyInstance) {
  app.get(
    "/api/search/documents",
    { preHandler: [requireAuth, requirePermission("documents:read")] },
    async (request) => {
      const query = request.query as Record<string, string>;
      const { page, pageSize } = parseSearchPaginationQuery(query);
      return searchDocuments(request.sessionUser!, {
        q: query.q ?? "",
        caseId: query.caseId,
        clientId: query.clientId,
        type: query.type,
        page,
        pageSize
      });
    }
  );
}
