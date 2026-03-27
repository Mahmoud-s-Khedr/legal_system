import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { AuthMode } from "@elms/shared";
import type { AppEnv } from "../../config/env.js";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { requireEditionFeature } from "../../middleware/requireEditionFeature.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import {
  createInvitation,
  listInvitations,
  revokeInvitation
} from "./invitations.service.js";

const createInvitationSchema = z.object({
  email: z.string().email(),
  roleId: z.string().uuid()
});

export async function registerInvitationRoutes(app: FastifyInstance, env: AppEnv) {
  app.get(
    "/api/invitations",
    {
      preHandler: [
        requireAuth,
        requirePermission("invitations:read"),
        requireEditionFeature("multi_user")
      ]
    },
    async (request, reply) => {
      if (env.AUTH_MODE !== AuthMode.CLOUD) {
        return reply.status(405).send({
          message: "Invitations are only available in cloud mode"
        });
      }

      const query = request.query as {
        q?: string;
        status?: string;
        sortBy?: string;
        sortDir?: "asc" | "desc";
        page?: string;
        limit?: string;
      };
      const { page, limit } = parsePaginationQuery(query);

      return listInvitations(request.sessionUser!, {
        q: query.q,
        status: query.status,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
        page,
        limit
      });
    }
  );

  app.post(
    "/api/invitations",
    {
      preHandler: [
        requireAuth,
        requirePermission("invitations:create"),
        requireEditionFeature("multi_user")
      ]
    },
    async (request, reply) => {
      if (env.AUTH_MODE !== AuthMode.CLOUD) {
        return reply.status(405).send({
          message: "Invitations are only available in cloud mode"
        });
      }

      const payload = createInvitationSchema.parse(request.body);
      return createInvitation(request.sessionUser!, payload, getAuditContext(request));
    }
  );

  app.post(
    "/api/invitations/:id/revoke",
    {
      preHandler: [
        requireAuth,
        requirePermission("invitations:revoke"),
        requireEditionFeature("multi_user")
      ]
    },
    async (request, reply) => {
      if (env.AUTH_MODE !== AuthMode.CLOUD) {
        return reply.status(405).send({
          message: "Invitations are only available in cloud mode"
        });
      }

      return revokeInvitation(
        request.sessionUser!,
        (request.params as { id: string }).id,
        getAuditContext(request)
      );
    }
  );
}
