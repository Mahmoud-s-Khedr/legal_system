import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { PoaStatus, PoaType } from "@elms/shared";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import {
  createPower,
  deletePower,
  getPower,
  listPowers,
  revokePower,
  updatePower
} from "./powers.service.js";

const createPoaSchema = z.object({
  clientId: z.string().uuid(),
  caseId: z.string().uuid().nullable().optional(),
  number: z.string().nullable().optional(),
  type: z.nativeEnum(PoaType),
  issuedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  scopeTextAr: z.string().nullable().optional(),
  hasSelfContractClause: z.boolean().optional(),
  commercialRegisterId: z.string().nullable().optional(),
  agentCertExpiry: z.string().datetime().nullable().optional(),
  agentResidencyStatus: z.string().nullable().optional()
});

const updatePoaSchema = z.object({
  number: z.string().nullable().optional(),
  issuedAt: z.string().datetime().nullable().optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  scopeTextAr: z.string().nullable().optional(),
  hasSelfContractClause: z.boolean().optional(),
  commercialRegisterId: z.string().nullable().optional(),
  agentCertExpiry: z.string().datetime().nullable().optional(),
  agentResidencyStatus: z.string().nullable().optional()
});

const revokePoaSchema = z.object({
  reason: z.string().nullable().optional()
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerPowersRoutes(app: FastifyInstance) {
  app.get(
    "/api/powers",
    { preHandler: [requireAuth, requirePermission("powers:read")] },
    async (request) => {
      const q = request.query as Record<string, string>;
      const { page, limit } = parsePaginationQuery(q);
      return listPowers(
        request.sessionUser!,
        {
          clientId: q.clientId,
          caseId: q.caseId,
          status: q.status as PoaStatus | undefined
        },
        { page, limit }
      );
    }
  );

  app.post(
    "/api/powers",
    { preHandler: [requireAuth, requirePermission("powers:create")] },
    async (request) => {
      const dto = createPoaSchema.parse(request.body);
      return createPower(request.sessionUser!, dto, getAuditContext(request));
    }
  );

  app.get(
    "/api/powers/:id",
    { preHandler: [requireAuth, requirePermission("powers:read")] },
    async (request) => getPower(request.sessionUser!, idParamsSchema.parse(request.params).id, getAuditContext(request))
  );

  app.put(
    "/api/powers/:id",
    { preHandler: [requireAuth, requirePermission("powers:update")] },
    async (request) => {
      const dto = updatePoaSchema.parse(request.body);
      return updatePower(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        dto,
        getAuditContext(request)
      );
    }
  );

  app.post(
    "/api/powers/:id/revoke",
    { preHandler: [requireAuth, requirePermission("powers:revoke")] },
    async (request) => {
      const dto = revokePoaSchema.parse(request.body);
      return revokePower(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        dto,
        getAuditContext(request)
      );
    }
  );

  app.delete(
    "/api/powers/:id",
    { preHandler: [requireAuth, requirePermission("powers:delete")] },
    async (request) => deletePower(request.sessionUser!, idParamsSchema.parse(request.params).id, getAuditContext(request))
  );
}
