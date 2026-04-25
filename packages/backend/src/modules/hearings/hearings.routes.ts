import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { SessionOutcome } from "@elms/shared";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import { hearingDtoSchema, hearingConflictSchema, listResponseSchema } from "../../schemas/index.js";
import type { AppEnv } from "../../config/env.js";
import {
  checkHearingConflict,
  createHearing,
  getHearing,
  listHearings,
  updateHearingOutcome,
  updateHearing
} from "./hearings.service.js";
import { pushHearingToCalendar } from "../integrations/googleCalendar.service.js";
import { hasEditionFeature } from "../editions/editionPolicy.js";


const hearingSchema = z.object({
  caseId: z.string().uuid(),
  assignedLawyerId: z.string().uuid().nullable().optional(),
  sessionDatetime: z.string().datetime(),
  nextSessionAt: z.string().datetime().nullable().optional(),
  outcome: z.nativeEnum(SessionOutcome).nullable().optional(),
  notes: z.string().nullable().optional()
});

const hearingListQuerySchema = z.object({
  q: z.string().optional(),
  caseId: z.string().uuid().optional(),
  assignedLawyerId: z.string().uuid().optional(),
  overdue: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional()
});

const hearingOutcomeSchema = z.object({
  outcome: z.nativeEnum(SessionOutcome).nullable()
});

const idParamsSchema = z.object({ id: z.string().min(1) });

export async function registerHearingRoutes(app: FastifyInstance, env: AppEnv) {
  app.get(
    "/api/hearings",
    {
      schema: { response: { 200: listResponseSchema(hearingDtoSchema) } },
      preHandler: [requireAuth, requirePermission("hearings:read")]
    },
    async (request) => {
      const query = request.query as Record<string, string>;
      const filters = hearingListQuerySchema.parse(query);
      const { page, limit } = parsePaginationQuery(query);
      return listHearings(request.sessionUser!, filters, { page, limit });
    }
  );

  app.post(
    "/api/hearings",
    {
      schema: { response: { 200: hearingDtoSchema } },
      preHandler: [requireAuth, requirePermission("hearings:create")]
    },
    async (request) => {
      const payload = hearingSchema.parse(request.body);
      const hearing = await createHearing(request.sessionUser!, payload, getAuditContext(request));
      const userId = request.sessionUser!.id;
      if (hasEditionFeature(request.sessionUser!.editionKey, "google_calendar_sync")) {
        setImmediate(() => {
          void pushHearingToCalendar(hearing.id, userId, env).catch((error) => {
            request.log.warn(
              {
                err: error,
                hearingId: hearing.id,
                userId
              },
              "Failed to sync hearing to Google Calendar after create"
            );
          });
        });
      }
      return hearing;
    }
  );

  app.get(
    "/api/hearings/conflicts",
    {
      schema: { response: { 200: hearingConflictSchema } },
      preHandler: [requireAuth, requirePermission("hearings:read")]
    },
    async (request) =>
      checkHearingConflict(request.sessionUser!, request.query as Record<string, string>)
  );

  app.get(
    "/api/hearings/:id",
    {
      schema: { response: { 200: hearingDtoSchema } },
      preHandler: [requireAuth, requirePermission("hearings:read")]
    },
    async (request) => getHearing(request.sessionUser!, idParamsSchema.parse(request.params).id)
  );

  app.put(
    "/api/hearings/:id",
    {
      schema: { response: { 200: hearingDtoSchema } },
      preHandler: [requireAuth, requirePermission("hearings:update")]
    },
    async (request) => {
      const payload = hearingSchema.parse(request.body);
      const hearing = await updateHearing(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
      const userId = request.sessionUser!.id;
      if (hasEditionFeature(request.sessionUser!.editionKey, "google_calendar_sync")) {
        setImmediate(() => {
          void pushHearingToCalendar(hearing.id, userId, env).catch((error) => {
            request.log.warn(
              {
                err: error,
                hearingId: hearing.id,
                userId
              },
              "Failed to sync hearing to Google Calendar after update"
            );
          });
        });
      }
      return hearing;
    }
  );

  app.patch(
    "/api/hearings/:id/outcome",
    {
      schema: { response: { 200: hearingDtoSchema } },
      preHandler: [requireAuth, requirePermission("hearings:update")]
    },
    async (request) =>
      updateHearingOutcome(
        request.sessionUser!,
        idParamsSchema.parse(request.params).id,
        hearingOutcomeSchema.parse(request.body),
        getAuditContext(request)
      )
  );
}
