import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { parseSearchPaginationQuery } from "../../utils/pagination.js";
import { globalSearch } from "./globalSearch.service.js";

const ALLOWED_ENTITIES = ["cases", "clients", "tasks", "documents", "library"] as const;
type AllowedEntity = (typeof ALLOWED_ENTITIES)[number];

const ENTITY_PERMISSION_MAP: Record<AllowedEntity, string> = {
  cases: "cases:read",
  clients: "clients:read",
  tasks: "tasks:read",
  documents: "documents:read",
  library: "library:read"
};

function resolveAllowedEntities(permissions: string[]): AllowedEntity[] {
  return ALLOWED_ENTITIES.filter((entity) =>
    permissions.includes(ENTITY_PERMISSION_MAP[entity])
  );
}

function getSingleQueryValue(input: unknown): string | undefined {
  if (typeof input === "string") {
    return input;
  }
  if (Array.isArray(input)) {
    const firstString = input.find((item): item is string => typeof item === "string");
    return firstString;
  }
  return undefined;
}

function parseRequestedEntities(raw: string | undefined): AllowedEntity[] | undefined {
  if (!raw) return undefined;
  const filtered = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is AllowedEntity =>
      (ALLOWED_ENTITIES as readonly string[]).includes(item)
    );
  return filtered.length > 0 ? filtered : undefined;
}

export async function registerGlobalSearchRoutes(app: FastifyInstance) {
  app.get(
    "/api/search/global",
    {
      preHandler: [
        requireAuth,
        async (request, reply) => {
          const allowedEntities = resolveAllowedEntities(
            request.sessionUser?.permissions ?? []
          );
          if (allowedEntities.length === 0) {
            return reply.status(403).send({ message: "Forbidden" });
          }
        }
      ]
    },
    async (request, reply) => {
      const actor = request.sessionUser!;
      const allowedEntities = resolveAllowedEntities(actor.permissions);

      if (allowedEntities.length === 0) {
        return reply.status(403).send({ message: "Forbidden" });
      }

      const query = (request.query ?? {}) as Record<string, unknown>;
      const q = getSingleQueryValue(query.q) ?? "";
      const requestedEntities = parseRequestedEntities(getSingleQueryValue(query.entities));
      const entities = (requestedEntities ?? allowedEntities).filter((entity) =>
        allowedEntities.includes(entity)
      );
      const { page, pageSize } = parseSearchPaginationQuery({
        page: getSingleQueryValue(query.page),
        pageSize: getSingleQueryValue(query.pageSize) ?? getSingleQueryValue(query.limit)
      });

      return globalSearch(actor, {
        q,
        entities: entities.length > 0 ? entities : allowedEntities,
        page,
        pageSize
      });
    }
  );
}
