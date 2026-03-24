import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { CaseRoleOnCase, CaseStatus } from "@elms/shared";
import { requireAuth } from "../../middleware/requireAuth.js";
import { requirePermission } from "../../middleware/requirePermission.js";
import { getAuditContext } from "../../utils/auditContext.js";
import { parsePaginationQuery } from "../../utils/pagination.js";
import { caseDtoSchema, listResponseSchema, successSchema } from "../../schemas/index.js";
import {
  addCaseAssignment,
  addCaseCourt,
  addCaseParty,
  changeCaseStatus,
  createCase,
  deleteCase,
  getCase,
  listCaseCourts,
  listCaseStatusHistory,
  listCases,
  removeCaseCourt,
  removeCaseParty,
  reorderCaseCourts,
  unassignCase,
  updateCase,
  updateCaseCourt
} from "./cases.service.js";

const caseSchema = z.object({
  clientId: z.string().uuid(),
  title: z.string().min(2),
  caseNumber: z.string().min(1),
  internalReference: z.string().nullable().optional(),
  judicialYear: z.number().int().nullable().optional(),
  type: z.string().min(1)
});

const caseUpdateSchema = z.object({
  clientId: z.string().uuid().optional(),
  title: z.string().min(2),
  caseNumber: z.string().min(1),
  internalReference: z.string().nullable().optional(),
  judicialYear: z.number().int().nullable().optional(),
  type: z.string().min(1)
});

const caseStatusSchema = z.object({
  status: z.nativeEnum(CaseStatus),
  note: z.string().nullable().optional()
});

const casePartySchema = z.object({
  clientId: z.string().uuid().nullable().optional(),
  name: z.string().min(2),
  role: z.string().min(1),
  isOurClient: z.boolean(),
  opposingCounselName: z.string().nullable().optional()
});

const caseAssignmentSchema = z.object({
  userId: z.string().uuid(),
  roleOnCase: z.nativeEnum(CaseRoleOnCase)
});

const caseCourtSchema = z.object({
  courtName: z.string().min(1),
  courtLevel: z.string().min(1),
  circuit: z.string().nullable().optional(),
  caseNumber: z.string().nullable().optional(),
  stageOrder: z.number().int().min(0).optional(),
  startedAt: z.string().nullable().optional(),
  notes: z.string().nullable().optional()
});

const caseCourtUpdateSchema = z.object({
  courtName: z.string().min(1),
  courtLevel: z.string().min(1),
  circuit: z.string().nullable().optional(),
  caseNumber: z.string().nullable().optional(),
  startedAt: z.string().nullable().optional(),
  endedAt: z.string().nullable().optional(),
  isActive: z.boolean(),
  notes: z.string().nullable().optional()
});

const caseCourtReorderSchema = z.object({
  orderedIds: z.array(z.string().uuid()).min(1)
});

const caseCourtDtoSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    caseId: { type: "string" },
    courtName: { type: "string" },
    courtLevel: { type: "string" },
    circuit: { type: ["string", "null"] },
    caseNumber: { type: ["string", "null"] },
    stageOrder: { type: "number" },
    startedAt: { type: ["string", "null"] },
    endedAt: { type: ["string", "null"] },
    isActive: { type: "boolean" },
    notes: { type: ["string", "null"] },
    createdAt: { type: "string" },
    updatedAt: { type: "string" }
  },
  required: ["id", "caseId", "courtName", "courtLevel", "stageOrder", "isActive", "createdAt", "updatedAt"],
  additionalProperties: false
} as const;

export async function registerCaseRoutes(app: FastifyInstance) {
  app.get(
    "/api/cases",
    {
      schema: { response: { 200: listResponseSchema(caseDtoSchema) } },
      preHandler: [requireAuth, requirePermission("cases:read")]
    },
    async (request) => {
      const query = request.query as { page?: string; limit?: string };
      const { page, limit } = parsePaginationQuery(query);
      return listCases(request.sessionUser!, { page, limit });
    }
  );

  app.post(
    "/api/cases",
    {
      schema: { response: { 200: caseDtoSchema } },
      preHandler: [requireAuth, requirePermission("cases:create")]
    },
    async (request) => {
      const payload = caseSchema.parse(request.body);
      return createCase(request.sessionUser!, payload, getAuditContext(request));
    }
  );

  app.get(
    "/api/cases/:id",
    {
      schema: { response: { 200: caseDtoSchema } },
      preHandler: [requireAuth, requirePermission("cases:read")]
    },
    async (request) => getCase(request.sessionUser!, (request.params as { id: string }).id)
  );

  app.put(
    "/api/cases/:id",
    {
      schema: { response: { 200: caseDtoSchema } },
      preHandler: [requireAuth, requirePermission("cases:update")]
    },
    async (request) => {
      const payload = caseUpdateSchema.parse(request.body);
      return updateCase(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.delete(
    "/api/cases/:id",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("cases:delete")]
    },
    async (request) =>
      deleteCase(
        request.sessionUser!,
        (request.params as { id: string }).id,
        getAuditContext(request)
      )
  );

  app.get(
    "/api/cases/:id/status-history",
    {
      preHandler: [requireAuth, requirePermission("cases:read")]
    },
    async (request) =>
      listCaseStatusHistory(request.sessionUser!, (request.params as { id: string }).id)
  );

  app.patch(
    "/api/cases/:id/status",
    {
      schema: { response: { 200: caseDtoSchema } },
      preHandler: [requireAuth, requirePermission("cases:status")]
    },
    async (request) => {
      const payload = caseStatusSchema.parse(request.body);
      return changeCaseStatus(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.post(
    "/api/cases/:id/parties",
    {
      preHandler: [requireAuth, requirePermission("cases:update")]
    },
    async (request) => {
      const payload = casePartySchema.parse(request.body);
      // Returns { case: CaseDto, conflictWarnings: ConflictWarningDto[] }
      return addCaseParty(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.delete(
    "/api/cases/:id/parties/:partyId",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("cases:update")]
    },
    async (request) =>
      removeCaseParty(
        request.sessionUser!,
        (request.params as { id: string; partyId: string }).id,
        (request.params as { id: string; partyId: string }).partyId,
        getAuditContext(request)
      )
  );

  app.post(
    "/api/cases/:id/assignments",
    {
      schema: { response: { 200: caseDtoSchema } },
      preHandler: [requireAuth, requirePermission("cases:assign")]
    },
    async (request) => {
      const payload = caseAssignmentSchema.parse(request.body);
      return addCaseAssignment(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.delete(
    "/api/cases/:id/assignments/:assignmentId",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("cases:assign")]
    },
    async (request) =>
      unassignCase(
        request.sessionUser!,
        (request.params as { id: string; assignmentId: string }).id,
        (request.params as { id: string; assignmentId: string }).assignmentId,
        getAuditContext(request)
      )
  );

  // ── Court Progression ────────────────────────────────────────────────────────

  app.get(
    "/api/cases/:id/courts",
    {
      schema: { response: { 200: { type: "array", items: caseCourtDtoSchema } } },
      preHandler: [requireAuth, requirePermission("cases:read")]
    },
    async (request) =>
      listCaseCourts(request.sessionUser!, (request.params as { id: string }).id)
  );

  app.post(
    "/api/cases/:id/courts",
    {
      schema: { response: { 200: caseCourtDtoSchema } },
      preHandler: [requireAuth, requirePermission("cases:update")]
    },
    async (request) => {
      const payload = caseCourtSchema.parse(request.body);
      return addCaseCourt(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.put(
    "/api/cases/:id/courts/:courtId",
    {
      schema: { response: { 200: caseCourtDtoSchema } },
      preHandler: [requireAuth, requirePermission("cases:update")]
    },
    async (request) => {
      const { id, courtId } = request.params as { id: string; courtId: string };
      const payload = caseCourtUpdateSchema.parse(request.body);
      return updateCaseCourt(request.sessionUser!, id, courtId, payload, getAuditContext(request));
    }
  );

  app.delete(
    "/api/cases/:id/courts/:courtId",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("cases:update")]
    },
    async (request) => {
      const { id, courtId } = request.params as { id: string; courtId: string };
      return removeCaseCourt(request.sessionUser!, id, courtId, getAuditContext(request));
    }
  );

  app.patch(
    "/api/cases/:id/courts/reorder",
    {
      schema: { response: { 200: { type: "array", items: caseCourtDtoSchema } } },
      preHandler: [requireAuth, requirePermission("cases:update")]
    },
    async (request) => {
      const payload = caseCourtReorderSchema.parse(request.body);
      return reorderCaseCourts(
        request.sessionUser!,
        (request.params as { id: string }).id,
        payload,
        getAuditContext(request)
      );
    }
  );
}
