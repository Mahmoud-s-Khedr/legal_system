import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../../config/env.js";
import { AuthMode, Language, UserStatus } from "@elms/shared";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import { newPasswordSchema } from "../../utils/passwordPolicy.js";
import { errorSchema, userDtoSchema, listResponseSchema, successSchema } from "../../schemas/index.js";
import {
  adminSetPassword,
  changeOwnPassword,
  createLocalUser,
  getUser,
  listUsers,
  removeUser,
  updateUser,
  updateUserStatus
} from "./users.service.js";

const createLocalUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  password: newPasswordSchema,
  roleId: z.string().uuid(),
  preferredLanguage: z.nativeEnum(Language).optional()
});

const updateUserSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email(),
  roleId: z.string().uuid(),
  preferredLanguage: z.nativeEnum(Language).optional(),
  status: z.nativeEnum(UserStatus).optional()
});

const changeOwnPasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: newPasswordSchema
});

const adminSetPasswordSchema = z.object({
  newPassword: newPasswordSchema
});

const updateUserStatusSchema = z.object({
  status: z.nativeEnum(UserStatus)
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerUserRoutes(app: FastifyInstance, env: AppEnv) {
  const userOrDisabledResponses = { 200: userDtoSchema, 405: errorSchema } as const;

  app.get(
    "/api/users",
    {
      schema: { response: { 200: listResponseSchema(userDtoSchema) } },
      preHandler: [requireAuth, requirePermission("users:read")]
    },
    async (request) => {
      const query = request.query as {
        q?: string;
        status?: string;
        roleId?: string;
        sortBy?: string;
        sortDir?: "asc" | "desc";
        page?: string;
        limit?: string;
      };
      const { page, limit } = parsePaginationQuery(query);
      return listUsers(request.sessionUser!, {
        q: query.q,
        status: query.status,
        roleId: query.roleId,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
        page,
        limit
      });
    }
  );

  app.get(
    "/api/users/:id",
    {
      schema: { response: { 200: userDtoSchema } },
      preHandler: [requireAuth, requirePermission("users:read")]
    },
    async (request) => getUser(request.sessionUser!, idParamsSchema.parse(request.params).id)
  );

  app.post(
    "/api/users",
    {
      schema: { response: userOrDisabledResponses },
      preHandler: [requireAuth, requirePermission("users:create")]
    },
    async (request, reply) => {
      if (env.AUTH_MODE !== AuthMode.LOCAL) {
        return reply.status(405).send({
          message: "Direct user creation is only available in local desktop mode"
        });
      }

      const payload = createLocalUserSchema.parse(request.body);
      return createLocalUser(request.sessionUser!, payload, getAuditContext(request));
    }
  );

  app.put(
    "/api/users/:id",
    {
      schema: { response: { 200: userDtoSchema } },
      preHandler: [requireAuth]
    },
    async (request) => {
      const payload = updateUserSchema.parse(request.body);
      return updateUser(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.post(
    "/api/users/me/password",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
    },
    async (request) => {
      const payload = changeOwnPasswordSchema.parse(request.body);
      return changeOwnPassword(request.sessionUser!, payload, getAuditContext(request));
    }
  );

  app.post(
    "/api/users/:id/password",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("users:update")],
      config: { rateLimit: { max: 10, timeWindow: "1 minute" } }
    },
    async (request) => {
      const payload = adminSetPasswordSchema.parse(request.body);
      return adminSetPassword(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.patch(
    "/api/users/:id/status",
    {
      schema: { response: { 200: userDtoSchema } },
      preHandler: [requireAuth, requirePermission("users:update")]
    },
    async (request) => {
      const payload = updateUserStatusSchema.parse(request.body);
      return updateUserStatus(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.delete(
    "/api/users/:id",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("users:delete")]
    },
    async (request) => {
      return removeUser(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        getAuditContext(request)
      );
    }
  );
}
