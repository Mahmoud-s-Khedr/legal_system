import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { successSchema } from "../../schemas/index.js";
import {
  createRole,
  deleteRole,
  getRole,
  listRoles,
  setRolePermissions,
  updateRole
} from "./roles.service.js";

const roleDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    firmId: { type: ["string", "null"] },
    key: { type: "string" },
    name: { type: "string" },
    scope: { type: "string" },
    permissions: { type: "array", items: { type: "string" } }
  },
  required: ["id", "firmId", "key", "name", "scope", "permissions"],
  additionalProperties: false
} as const;

const createRoleSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/, "Key must be lowercase alphanumeric with underscores"),
  name: z.string().min(2).max(100)
});

const updateRoleSchema = z.object({
  name: z.string().min(2).max(100)
});

const setPermissionsSchema = z.object({
  permissionKeys: z.array(z.string().min(1))
});

export async function registerRoleRoutes(app: FastifyInstance) {
  app.get(
    "/api/roles",
    {
      preHandler: [requireAuth, requirePermission("roles:read")]
    },
    async (request) => {
      const query = request.query as Record<string, string>;
      const { page, limit } = parsePaginationQuery(query);
      return listRoles(request.sessionUser!, { page, limit });
    }
  );

  app.get(
    "/api/roles/:id",
    {
      preHandler: [requireAuth, requirePermission("roles:read")]
    },
    async (request) => getRole(request.sessionUser!, (request.params as { id: string }).id)
  );

  app.post(
    "/api/roles",
    {
      schema: { response: { 200: roleDtoSchema } },
      preHandler: [requireAuth, requirePermission("roles:create")]
    },
    async (request) => {
      const payload = createRoleSchema.parse(request.body);
      return createRole(request.sessionUser!, payload, getAuditContext(request));
    }
  );

  app.put(
    "/api/roles/:id",
    {
      schema: { response: { 200: roleDtoSchema } },
      preHandler: [requireAuth, requirePermission("roles:update")]
    },
    async (request) => {
      const payload = updateRoleSchema.parse(request.body);
      return updateRole(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.delete(
    "/api/roles/:id",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("roles:delete")]
    },
    async (request) =>
      deleteRole(
        request.sessionUser!,
        (request.params as { id: string }).id,
        getAuditContext(request)
      )
  );

  app.put(
    "/api/roles/:id/permissions",
    {
      schema: { response: { 200: roleDtoSchema } },
      preHandler: [requireAuth, requirePermission("roles:update")]
    },
    async (request) => {
      const payload = setPermissionsSchema.parse(request.body);
      return setRolePermissions(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );
}
