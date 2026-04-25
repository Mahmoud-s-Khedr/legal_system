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
  listCaseAssignments,
  listCaseParties,
  listCaseCourts,
  listCaseStatusHistory,
  listCases,
  removeCaseCourt,
  removeCaseParty,
  updateCaseParty,
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
  name: z.string().min(1),
  role: z.string().min(1),
  partyType: z.enum(["CLIENT", "OPPONENT", "EXTERNAL"])
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

const casePartyListQuerySchema = z.object({
  q: z.string().optional(),
  role: z.string().optional(),
  partyType: z.enum(["CLIENT", "OPPONENT", "EXTERNAL"]).optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

const idParamsSchema = z.object({ id: z.string().min(1) });
const idPartyParamsSchema = z.object({ id: z.string().min(1), partyId: z.string().min(1) });
const idAssignmentParamsSchema = z.object({ id: z.string().min(1), assignmentId: z.string().min(1) });
const idCourtParamsSchema = z.object({ id: z.string().min(1), courtId: z.string().min(1) });

const caseAssignmentListQuerySchema = z.object({
  q: z.string().optional(),
  roleOnCase: z.nativeEnum(CaseRoleOnCase).optional(),
  active: z.enum(["true", "false"]).optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.string().optional(),
  limit: z.string().optional()
});

const caseCourtListQuerySchema = z.object({
  q: z.string().optional(),
  courtLevel: z.string().optional(),
  isActive: z.enum(["true", "false"]).optional(),
  sortBy: z.string().optional(),
  sortDir: z.enum(["asc", "desc"]).optional(),
  page: z.string().optional(),
  limit: z.string().optional()
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
      const query = request.query as {
        q?: string;
        status?: string;
        type?: string;
        assignedLawyerId?: string;
        createdFrom?: string;
        createdTo?: string;
        sortBy?: string;
        sortDir?: "asc" | "desc";
        page?: string;
        limit?: string;
      };
      const { page, limit } = parsePaginationQuery(query);
      return listCases(request.sessionUser!, {
        q: query.q,
        status: query.status,
        type: query.type,
        assignedLawyerId: query.assignedLawyerId,
        createdFrom: query.createdFrom,
        createdTo: query.createdTo,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
        page,
        limit
      });
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
    async (request) => getCase(request.sessionUser!, idParamsSchema.parse(request.params).id)
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
        idParamsSchema.parse(request.params).id,
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
    async (request) => deleteCase(request.sessionUser!, idParamsSchema.parse(request.params).id, getAuditContext(request))
  );

  app.get(
    "/api/cases/:id/status-history",
    {
      preHandler: [requireAuth, requirePermission("cases:read")]
    },
    async (request) => listCaseStatusHistory(request.sessionUser!, idParamsSchema.parse(request.params).id)
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
        idParamsSchema.parse(request.params).id,
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
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.get(
    "/api/cases/:id/parties",
    {
      preHandler: [requireAuth, requirePermission("cases:read")]
    },
    async (request) => {
      const query = casePartyListQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(query);
      return listCaseParties(request.sessionUser!, idParamsSchema.parse(request.params).id, {
        q: query.q,
        role: query.role,
        partyType: query.partyType,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
        page,
        limit
      });
    }
  );

  app.delete(
    "/api/cases/:id/parties/:partyId",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("cases:update")]
    },
    async (request) => {
      const { id, partyId } = idPartyParamsSchema.parse(request.params);
      return removeCaseParty(request.sessionUser!, id, partyId, getAuditContext(request));
    }
  );

  app.put(
    "/api/cases/:id/parties/:partyId",
    {
      preHandler: [requireAuth, requirePermission("cases:update")]
    },
    async (request) => {
      const { id, partyId } = idPartyParamsSchema.parse(request.params);
      const payload = casePartySchema.parse(request.body);
      return updateCaseParty(
        request.sessionUser!,
        id,
        partyId,
        payload,
        getAuditContext(request)
      );
    }
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
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
    }
  );

  app.get(
    "/api/cases/:id/assignments",
    {
      preHandler: [requireAuth, requirePermission("cases:read")]
    },
    async (request) => {
      const query = caseAssignmentListQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(query);
      return listCaseAssignments(request.sessionUser!, idParamsSchema.parse(request.params).id, {
        q: query.q,
        roleOnCase: query.roleOnCase,
        active: query.active,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
        page,
        limit
      });
    }
  );

  app.delete(
    "/api/cases/:id/assignments/:assignmentId",
    {
      schema: { response: { 200: successSchema } },
      preHandler: [requireAuth, requirePermission("cases:assign")]
    },
    async (request) => {
      const { id, assignmentId } = idAssignmentParamsSchema.parse(request.params);
      return unassignCase(request.sessionUser!, id, assignmentId, getAuditContext(request));
    }
  );

  // ── Court Progression ────────────────────────────────────────────────────────

  app.get(
    "/api/cases/:id/courts",
    {
      schema: { response: { 200: listResponseSchema(caseCourtDtoSchema) } },
      preHandler: [requireAuth, requirePermission("cases:read")]
    },
    async (request) => {
      const query = caseCourtListQuerySchema.parse(request.query as Record<string, string>);
      const { page, limit } = parsePaginationQuery(query);
      return listCaseCourts(request.sessionUser!, idParamsSchema.parse(request.params).id, {
        q: query.q,
        courtLevel: query.courtLevel,
        isActive: query.isActive,
        sortBy: query.sortBy,
        sortDir: query.sortDir,
        page,
        limit
      });
    }
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
        idParamsSchema.parse(request.params).id,
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
      const { id, courtId } = idCourtParamsSchema.parse(request.params);
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
      const { id, courtId } = idCourtParamsSchema.parse(request.params);
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
        idParamsSchema.parse(request.params).id,
        payload,
        getAuditContext(request)
      );
    }
  );
}
