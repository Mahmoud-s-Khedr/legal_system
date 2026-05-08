import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../../middleware/requireAuth.js";
import { listResponseSchema } from "../../schemas/index.js";
import { listCitiesByGovernorate, listGovernorates } from "./locations.service.js";

const governorateOptionSchema = {
  type: "object",
  properties: {
    key: { type: "string" },
    value: { type: "string" },
    labelAr: { type: "string" },
    labelEn: { type: "string" },
    labelFr: { type: "string" }
  },
  required: ["key", "value", "labelAr", "labelEn", "labelFr"],
  additionalProperties: false
} as const;

const cityOptionSchema = {
  type: "object",
  properties: {
    governorateKey: { type: "string" },
    key: { type: "string" },
    value: { type: "string" },
    labelAr: { type: "string" },
    labelEn: { type: "string" },
    labelFr: { type: "string" }
  },
  required: ["governorateKey", "key", "value", "labelAr", "labelEn", "labelFr"],
  additionalProperties: false
} as const;

const cityParamsSchema = z.object({ governorate: z.string().min(1) });

export async function registerLocationLookupRoutes(app: FastifyInstance) {
  app.get(
    "/api/location-lookups/governorates",
    {
      schema: { response: { 200: listResponseSchema(governorateOptionSchema) } },
      preHandler: [requireAuth]
    },
    async (request) => listGovernorates(request.sessionUser!)
  );

  app.get(
    "/api/location-lookups/cities/:governorate",
    {
      schema: { response: { 200: listResponseSchema(cityOptionSchema) } },
      preHandler: [requireAuth]
    },
    async (request) => {
      const { governorate } = cityParamsSchema.parse(request.params);
      return listCitiesByGovernorate(request.sessionUser!, governorate);
    }
  );
}
