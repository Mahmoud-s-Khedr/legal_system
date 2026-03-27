import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { ClientType, Language } from "@elms/shared";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import { clientDtoSchema, listResponseSchema, successSchema } from "../../schemas/index.js";
import {
  createClient,
  getClient,
  listClients,
  removeClient,
  updateClient
} from "./clients.service.js";

const contactSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(3),
  email: z.string().email().nullable().optional(),
  role: z.string().nullable().optional()
});

const clientSchema = z.object({
  name: z.string().min(2),
  type: z.nativeEnum(ClientType),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional(),
  governorate: z.string().nullable().optional(),
  preferredLanguage: z.nativeEnum(Language).optional(),
  nationalId: z.string().nullable().optional(),
  commercialRegister: z.string().nullable().optional(),
  taxNumber: z.string().nullable().optional(),
  contacts: z.array(contactSchema).optional()
});

export async function registerClientRoutes(app: FastifyInstance) {
  app.get(
    "/api/clients",
    {
      schema: { response: { 200: listResponseSchema(clientDtoSchema) } },
      preHandler: [requireAuth, requirePermission("clients:read")]
    },
    async (request) => {
      const query = request.query as {
        q?: string;
        search?: string;
        type?: string;
        sortBy?: string;
        sortDir?: "asc" | "desc";
        page?: string;
        limit?: string;
      };
      const { page, limit } = parsePaginationQuery(query);
      return listClients(request.sessionUser!, {
        q: query.q ?? query.search,
        type: query.type,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
        page,
        limit
      });
    }
  );

  app.post(
    "/api/clients",
    {
      schema: { response: { 200: clientDtoSchema } },
      preHandler: [requireAuth, requirePermission("clients:create")]
    },
    async (request) => {
      const payload = clientSchema.parse(request.body);
      const { client } = await createClient(request.sessionUser!, payload, getAuditContext(request));
      return client;
    }
  );

  app.get(
    "/api/clients/:id",
    {
      schema: { response: { 200: clientDtoSchema } },
      preHandler: [requireAuth, requirePermission("clients:read")]
    },
    async (request) => getClient(request.sessionUser!, (request.params as { id: string }).id)
  );

  app.put(
    "/api/clients/:id",
    {
      schema: { response: { 200: clientDtoSchema } },
      preHandler: [requireAuth, requirePermission("clients:update")]
    },
    async (request) => {
      const payload = clientSchema.parse(request.body);
      return updateClient(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.delete(
    "/api/clients/:id",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("clients:delete")]
    },
    async (request) =>
      removeClient(
        request.sessionUser!,
        (request.params as { id: string }).id,
        getAuditContext(request)
      )
  );
}
