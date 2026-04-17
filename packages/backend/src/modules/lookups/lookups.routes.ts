import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { listResponseSchema, successSchema } from "../../schemas/index.js";
import { appError } from "../../errors/appError.js";
import {
  LOOKUP_ENTITIES,
  type LookupEntity,
  createLookupOption,
  deleteLookupOption,
  listLookupOptions,
  updateLookupOption
} from "./lookups.service.js";

const lookupOptionDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    firmId: { type: ["string", "null"] },
    entity: { type: "string" },
    key: { type: "string" },
    labelAr: { type: "string" },
    labelEn: { type: "string" },
    labelFr: { type: "string" },
    isSystem: { type: "boolean" },
    isActive: { type: "boolean" },
    sortOrder: { type: "number" },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["id", "firmId", "entity", "key", "labelAr", "labelEn", "labelFr", "isSystem", "isActive", "sortOrder", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

const createLookupSchema = z.object({
  key: z.string().min(1).max(64).regex(/^[A-Z0-9_]+$/, "Key must be uppercase alphanumeric with underscores"),
  labelAr: z.string().min(1),
  labelEn: z.string().min(1),
  labelFr: z.string().min(1),
  sortOrder: z.number().int().min(0).optional()
});

const updateLookupSchema = z.object({
  labelAr: z.string().min(1),
  labelEn: z.string().min(1),
  labelFr: z.string().min(1),
  isActive: z.boolean(),
  sortOrder: z.number().int().min(0)
});

function assertValidEntity(entity: string): asserts entity is LookupEntity {
  if (!(LOOKUP_ENTITIES as readonly string[]).includes(entity)) {
    throw appError(
      `Unknown lookup entity: "${entity}". Valid entities: ${LOOKUP_ENTITIES.join(", ")}`,
      400
    );
  }
}

export async function registerLookupRoutes(app: FastifyInstance) {
  app.get(
    "/api/lookups/:entity",
    {
      schema: { response: { 200: listResponseSchema(lookupOptionDtoSchema) } },
      preHandler: [requireAuth]
    },
    async (request) => {
      const { entity } = request.params as { entity: string };
      assertValidEntity(entity);
      return listLookupOptions(request.sessionUser!, entity);
    }
  );

  app.post(
    "/api/lookups/:entity",
    {
      schema: { response: { 200: lookupOptionDtoSchema } },
      preHandler: [requireAuth, requirePermission("lookups:manage")]
    },
    async (request) => {
      const { entity } = request.params as { entity: string };
      assertValidEntity(entity);
      const payload = createLookupSchema.parse(request.body);
      return createLookupOption(request.sessionUser!, entity, payload, getAuditContext(request));
    }
  );

  app.put(
    "/api/lookups/:entity/:id",
    {
      schema: { response: { 200: lookupOptionDtoSchema } },
      preHandler: [requireAuth, requirePermission("lookups:manage")]
    },
    async (request) => {
      const { entity, id } = request.params as { entity: string; id: string };
      assertValidEntity(entity);
      const payload = updateLookupSchema.parse(request.body);
      return updateLookupOption(request.sessionUser!, entity, id, payload, getAuditContext(request));
    }
  );

  app.delete(
    "/api/lookups/:entity/:id",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("lookups:manage")]
    },
    async (request) => {
      const { entity, id } = request.params as { entity: string; id: string };
      assertValidEntity(entity);
      return deleteLookupOption(request.sessionUser!, entity, id, getAuditContext(request));
    }
  );
}
