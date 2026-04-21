import type {
  CaseRoleOnCase,
  CaseAssignmentDto,
  CasePartyDto,
  CasePartyType,
  CaseCourtDto,
  CaseStatus as SharedCaseStatus,
  CaseDto,
  CaseListResponseDto,
  ChangeCaseStatusDto,
  ConflictWarningDto,
  CreateCaseAssignmentDto,
  CreateCaseCourtDto,
  CreateCaseDto,
  CreateCasePartyDto,
  ReorderCaseCourtsDto,
  SessionUser,
  UpdateCaseCourtDto,
  UpdateCasePartyDto,
  UpdateCaseDto
} from "@elms/shared";
import { CaseStatus, CaseRoleOnCase as PrismaCaseRoleOnCase, Prisma } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";
import { buildFuzzySearchCandidates } from "../../utils/fuzzySearch.js";
import { appError } from "../../errors/appError.js";

function mapCourt(court: {
  id: string;
  caseId: string;
  courtName: string;
  courtLevel: string;
  circuit: string | null;
  caseNumber: string | null;
  stageOrder: number;
  startedAt: Date | null;
  endedAt: Date | null;
  isActive: boolean;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
}): CaseCourtDto {
  return {
    id: court.id,
    caseId: court.caseId,
    courtName: court.courtName,
    courtLevel: court.courtLevel,
    circuit: court.circuit,
    caseNumber: court.caseNumber,
    stageOrder: court.stageOrder,
    startedAt: court.startedAt?.toISOString() ?? null,
    endedAt: court.endedAt?.toISOString() ?? null,
    isActive: court.isActive,
    notes: court.notes,
    createdAt: court.createdAt.toISOString(),
    updatedAt: court.updatedAt.toISOString()
  };
}

function mapCaseAssignment(assignment: {
  id: string;
  userId: string;
  roleOnCase: string;
  assignedAt: Date;
  unassignedAt: Date | null;
  user: { fullName: string };
}): CaseAssignmentDto {
  return {
    id: assignment.id,
    userId: assignment.userId,
    userName: assignment.user.fullName,
    roleOnCase: assignment.roleOnCase as CaseRoleOnCase,
    assignedAt: assignment.assignedAt.toISOString(),
    unassignedAt: assignment.unassignedAt?.toISOString() ?? null
  };
}

function mapCaseParty(party: {
  id: string;
  clientId: string | null;
  name: string;
  role: string;
  partyType: string;
}): CasePartyDto {
  return {
    id: party.id,
    clientId: party.clientId,
    name: party.name,
    role: party.role,
    partyType: party.partyType as CasePartyType
  };
}

function mapCase(caseRecord: {
  id: string;
  clientId: string | null;
  title: string;
  caseNumber: string;
  internalReference: string | null;
  judicialYear: number | null;
  type: string;
  status: CaseStatus;
  createdAt: Date;
  updatedAt: Date;
  courts: Array<{
    id: string;
    caseId: string;
    courtName: string;
    courtLevel: string;
    circuit: string | null;
    caseNumber: string | null;
    stageOrder: number;
    startedAt: Date | null;
    endedAt: Date | null;
    isActive: boolean;
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  }>;
  assignments: Array<{
    id: string;
    userId: string;
    roleOnCase: string;
    assignedAt: Date;
    unassignedAt: Date | null;
    user: { fullName: string };
  }>;
  parties: Array<{
    id: string;
    clientId: string | null;
    name: string;
    role: string;
    partyType: string;
  }>;
  statusHistory: Array<{
    id: string;
    fromStatus: CaseStatus | null;
    toStatus: CaseStatus;
    changedAt: Date;
    note: string | null;
  }>;
  _count: {
    sessions: number;
    tasks: number;
  };
}): CaseDto {
  return {
    id: caseRecord.id,
    clientId: caseRecord.clientId,
    title: caseRecord.title,
    caseNumber: caseRecord.caseNumber,
    internalReference: caseRecord.internalReference,
    judicialYear: caseRecord.judicialYear,
    type: caseRecord.type,
    status: caseRecord.status as SharedCaseStatus,
    courts: caseRecord.courts
      .sort((a, b) => a.stageOrder - b.stageOrder)
      .map(mapCourt),
    assignments: caseRecord.assignments.map(mapCaseAssignment),
    parties: caseRecord.parties.map(mapCaseParty),
    statusHistory: caseRecord.statusHistory.map((entry) => ({
      id: entry.id,
      fromStatus: entry.fromStatus as SharedCaseStatus | null,
      toStatus: entry.toStatus as SharedCaseStatus,
      changedAt: entry.changedAt.toISOString(),
      note: entry.note
    })),
    hearingCount: caseRecord._count.sessions,
    taskCount: caseRecord._count.tasks,
    createdAt: caseRecord.createdAt.toISOString(),
    updatedAt: caseRecord.updatedAt.toISOString()
  };
}

const CASE_INCLUDE = {
  courts: {
    orderBy: { stageOrder: "asc" as const }
  },
  assignments: {
    where: { unassignedAt: null },
    select: {
      id: true,
      userId: true,
      roleOnCase: true,
      assignedAt: true,
      unassignedAt: true,
      user: { select: { fullName: true } }
    },
    orderBy: { assignedAt: "desc" as const }
  },
  parties: {
    select: {
      id: true,
      clientId: true,
      name: true,
      role: true,
      partyType: true
    }
  },
  statusHistory: {
    select: {
      id: true,
      fromStatus: true,
      toStatus: true,
      changedAt: true,
      note: true
    },
    orderBy: { changedAt: "desc" as const }
  },
  _count: {
    select: { sessions: true, tasks: true }
  }
} as const;

async function getCaseRecord(
  actor: SessionUser,
  caseId: string
): Promise<CaseDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const caseRecord = await tx.case.findFirstOrThrow({
      where: { id: caseId, firmId: actor.firmId, deletedAt: null },
      include: CASE_INCLUDE
    });

    return mapCase(caseRecord);
  });
}

export async function listCases(
  actor: SessionUser,
  query: {
    q?: string;
    status?: string;
    type?: string;
    assignedLawyerId?: string;
    createdFrom?: string;
    createdTo?: string;
    sortBy?: string;
    sortDir?: SortDir;
    page: number;
    limit: number;
  }
): Promise<CaseListResponseDto> {
  const { page, limit } = query;
  const q = query.q?.trim();
  const searchCandidates = buildFuzzySearchCandidates(q);
  const sortBy = normalizeSort(query.sortBy, ["updatedAt", "createdAt", "title", "caseNumber", "status"] as const, "updatedAt");
  const sortDir = toPrismaSortOrder(query.sortDir ?? "desc");

  return withTenant(prisma, actor.firmId, async (tx) => {
    const where = {
      firmId: actor.firmId,
      deletedAt: null,
      ...(query.status ? { status: query.status as CaseStatus } : {}),
      ...(query.type ? { type: query.type } : {}),
      ...(query.assignedLawyerId
        ? { assignments: { some: { userId: query.assignedLawyerId, unassignedAt: null } } }
        : {}),
      ...(query.createdFrom || query.createdTo
        ? {
            createdAt: {
              ...(query.createdFrom ? { gte: new Date(query.createdFrom) } : {}),
              ...(query.createdTo ? { lte: new Date(query.createdTo) } : {})
            }
          }
        : {}),
      ...(searchCandidates.length > 0
        ? {
            OR: searchCandidates.flatMap((candidate) => [
              { title: { contains: candidate, mode: "insensitive" as const } },
              {
                caseNumber: {
                  contains: candidate,
                  mode: "insensitive" as const
                }
              },
              {
                internalReference: {
                  contains: candidate,
                  mode: "insensitive" as const
                }
              }
            ])
          }
        : {})
    };
    const [total, cases] = await Promise.all([
      tx.case.count({ where }),
      tx.case.findMany({
        where,
        include: {
          ...CASE_INCLUDE,
          statusHistory: {
            ...CASE_INCLUDE.statusHistory,
            take: 5
          }
        },
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return { items: cases.map(mapCase), total, page, pageSize: limit };
  });
}

export async function getCase(actor: SessionUser, caseId: string) {
  return getCaseRecord(actor, caseId);
}

export async function createCase(
  actor: SessionUser,
  payload: CreateCaseDto,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    // Validate that the client exists in this firm and get its name
    const client = await tx.client.findFirstOrThrow({
      where: { id: payload.clientId, firmId: actor.firmId, deletedAt: null },
      select: { name: true }
    });

    const caseRecord = await tx.case.create({
      data: {
        firmId: actor.firmId,
        clientId: payload.clientId,
        title: payload.title,
        caseNumber: payload.caseNumber,
        internalReference: payload.internalReference ?? null,
        judicialYear: payload.judicialYear ?? null,
        type: payload.type,
        status: CaseStatus.ACTIVE,
        statusHistory: {
          create: {
            toStatus: CaseStatus.ACTIVE,
            note: "Case created"
          }
        },
        parties: {
          create: {
            clientId: payload.clientId,
            name: client.name,
            role: "CLIENT",
            partyType: "CLIENT"
          }
        }
      },
      include: CASE_INCLUDE
    });

    await writeAuditLog(tx, audit, {
      action: "cases.create",
      entityType: "Case",
      entityId: caseRecord.id,
      newData: {
        title: caseRecord.title,
        caseNumber: caseRecord.caseNumber,
        clientId: caseRecord.clientId
      }
    });

    return mapCase(caseRecord);
  });
}


export async function updateCase(
  actor: SessionUser,
  caseId: string,
  payload: UpdateCaseDto,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.case.findFirstOrThrow({
      where: { id: caseId, firmId: actor.firmId, deletedAt: null }
    });

    // If clientId is being changed, validate the new client
    if (payload.clientId && payload.clientId !== existing.clientId) {
      await tx.client.findFirstOrThrow({
        where: { id: payload.clientId, firmId: actor.firmId, deletedAt: null }
      });
    }

    const caseRecord = await tx.case.update({
      where: { id: caseId },
      data: {
        clientId: payload.clientId ?? existing.clientId,
        title: payload.title,
        caseNumber: payload.caseNumber,
        internalReference: payload.internalReference ?? null,
        judicialYear: payload.judicialYear ?? null,
        type: payload.type
      },
      include: CASE_INCLUDE
    });

    await writeAuditLog(tx, audit, {
      action: "cases.update",
      entityType: "Case",
      entityId: caseId,
      oldData: { title: existing.title, status: existing.status },
      newData: { title: caseRecord.title, status: caseRecord.status }
    });

    return mapCase(caseRecord);
  });
}

export async function deleteCase(
  actor: SessionUser,
  caseId: string,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.case.findFirstOrThrow({
      where: { id: caseId, firmId: actor.firmId, deletedAt: null }
    });

    await tx.case.update({
      where: { id: caseId },
      data: { deletedAt: new Date() }
    });

    await writeAuditLog(tx, audit, {
      action: "cases.delete",
      entityType: "Case",
      entityId: caseId,
      oldData: { title: existing.title }
    });

    return { success: true as const };
  });
}

const ALLOWED_STATUS_TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
  [CaseStatus.ACTIVE]: [CaseStatus.SUSPENDED, CaseStatus.CLOSED, CaseStatus.WON, CaseStatus.LOST, CaseStatus.SETTLED],
  [CaseStatus.SUSPENDED]: [CaseStatus.ACTIVE, CaseStatus.CLOSED],
  [CaseStatus.CLOSED]: [CaseStatus.ARCHIVED],
  [CaseStatus.WON]: [CaseStatus.ARCHIVED],
  [CaseStatus.LOST]: [CaseStatus.ARCHIVED],
  [CaseStatus.SETTLED]: [CaseStatus.ARCHIVED],
  [CaseStatus.ARCHIVED]: []
};

export async function changeCaseStatus(
  actor: SessionUser,
  caseId: string,
  payload: ChangeCaseStatusDto,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.case.findFirstOrThrow({
      where: { id: caseId, firmId: actor.firmId, deletedAt: null }
    });

    const toStatus = payload.status as CaseStatus;
    const allowed = ALLOWED_STATUS_TRANSITIONS[existing.status] ?? [];
    if (!allowed.includes(toStatus)) {
      throw appError(`Cannot transition case from ${existing.status} to ${toStatus}`, 422);
    }

    await tx.case.update({
      where: { id: caseId },
      data: { status: payload.status as CaseStatus }
    });

    await tx.caseStatusHistory.create({
      data: {
        caseId,
        fromStatus: existing.status,
        toStatus: payload.status as CaseStatus,
        note: payload.note ?? null
      }
    });

    await writeAuditLog(tx, audit, {
      action: "cases.status",
      entityType: "Case",
      entityId: caseId,
      oldData: { status: existing.status },
      newData: { status: payload.status }
    });

    return getCaseRecord(actor, caseId);
  });
}

/**
 * Check whether adding an opposing party would create a conflict of interest.
 * A conflict exists when the party name or nationalId matches an existing
 * client in the firm's client database.
 * Returns an array of warnings (non-blocking — the caller decides whether to proceed).
 */
export async function checkConflictOfInterest(
  firmId: string,
  partyName: string,
  partyNationalId?: string | null
): Promise<ConflictWarningDto[]> {
  // Find cases where this name appears as an opposing party
  const conflicts = await prisma.caseParty.findMany({
    where: {
      case: { firmId, deletedAt: null },
      partyType: "OPPONENT",
      OR: [
        { name: { contains: partyName, mode: "insensitive" } },
        ...(partyNationalId
          ? [
              {
                client: {
                  nationalId: partyNationalId
                }
              }
            ]
          : [])
      ]
    },
    select: {
      name: true,
      case: { select: { id: true, title: true } }
    },
    take: 10
  });

  // Also check if this party is a firm client
  const clientMatches = await prisma.client.findMany({
    where: {
      firmId,
      deletedAt: null,
      OR: [
        { name: { contains: partyName, mode: "insensitive" } },
        ...(partyNationalId ? [{ nationalId: partyNationalId }] : [])
      ]
    },
    select: {
      name: true,
      parties: {
        where: { partyType: "OPPONENT" },
        select: { case: { select: { id: true, title: true } } },
        take: 5
      }
    }
  });

  const warnings: ConflictWarningDto[] = [];

  for (const conflict of conflicts) {
    warnings.push({
      name: conflict.name,
      conflictingCaseId: conflict.case.id,
      conflictingCaseTitle: conflict.case.title
    });
  }

  for (const client of clientMatches) {
    for (const party of client.parties) {
      warnings.push({
        name: client.name,
        conflictingCaseId: party.case.id,
        conflictingCaseTitle: party.case.title
      });
    }
  }

  return warnings;
}

export async function addCaseParty(
  actor: SessionUser,
  caseId: string,
  payload: CreateCasePartyDto,
  audit: AuditContext
): Promise<{ case: CaseDto; conflictWarnings: ConflictWarningDto[] }> {
  // Check for conflict of interest on opponent parties (non-blocking)
  let conflictWarnings: ConflictWarningDto[] = [];
  if (payload.partyType === "OPPONENT") {
    conflictWarnings = await checkConflictOfInterest(
      actor.firmId,
      payload.name,
      undefined
    );
  }

  const updatedCase = await withTenant(prisma, actor.firmId, async (tx) => {
    await tx.case.findFirstOrThrow({
      where: { id: caseId, firmId: actor.firmId, deletedAt: null },
      select: { id: true }
    });

    // If adding a CLIENT party, validate the linked clientId
    let clientName = payload.name;
    if (payload.partyType === "CLIENT") {
      if (!payload.clientId) {
        throw appError("clientId is required when adding a CLIENT party", 422);
      }
      const linkedClient = await tx.client.findFirstOrThrow({
        where: { id: payload.clientId, firmId: actor.firmId, deletedAt: null },
        select: { name: true }
      });
      clientName = linkedClient.name;
    }

    const party = await tx.caseParty.create({
      data: {
        caseId,
        clientId: payload.clientId ?? null,
        name: clientName,
        role: payload.role,
        partyType: payload.partyType
      }
    });

    await writeAuditLog(tx, audit, {
      action: "cases.parties.create",
      entityType: "CaseParty",
      entityId: party.id,
      newData: { caseId, name: clientName, role: payload.role, partyType: payload.partyType }
    });

    return getCaseRecord(actor, caseId);
  });

  return { case: updatedCase, conflictWarnings };
}

export async function updateCaseParty(
  actor: SessionUser,
  caseId: string,
  partyId: string,
  payload: UpdateCasePartyDto,
  audit: AuditContext
): Promise<CaseDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.caseParty.findFirstOrThrow({
      where: { id: partyId, caseId, case: { firmId: actor.firmId, deletedAt: null } }
    });

    // If changing away from CLIENT, ensure at least one CLIENT party remains
    if (existing.partyType === "CLIENT" && payload.partyType !== "CLIENT") {
      const clientCount = await tx.caseParty.count({
        where: { caseId, partyType: "CLIENT" }
      });
      if (clientCount <= 1) {
        throw appError("A case must have at least one client party", 422);
      }
    }

    // Auto-populate name from linked client
    let clientName = payload.name;
    if (payload.partyType === "CLIENT") {
      if (!payload.clientId) {
        throw appError("clientId is required when updating a party to CLIENT type", 422);
      }
      const linkedClient = await tx.client.findFirstOrThrow({
        where: { id: payload.clientId, firmId: actor.firmId, deletedAt: null },
        select: { name: true }
      });
      clientName = linkedClient.name;
    }

    await tx.caseParty.update({
      where: { id: partyId },
      data: {
        clientId: payload.clientId ?? null,
        name: clientName,
        role: payload.role,
        partyType: payload.partyType
      }
    });

    await writeAuditLog(tx, audit, {
      action: "cases.parties.update",
      entityType: "CaseParty",
      entityId: partyId,
      oldData: { name: existing.name, role: existing.role, partyType: existing.partyType },
      newData: { name: clientName, role: payload.role, partyType: payload.partyType }
    });

    return getCaseRecord(actor, caseId);
  });
}


export async function removeCaseParty(
  actor: SessionUser,
  caseId: string,
  partyId: string,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.caseParty.findFirstOrThrow({
      where: { id: partyId, caseId, case: { firmId: actor.firmId, deletedAt: null } }
    });

    // Block deletion if it is the last CLIENT party
    if (existing.partyType === "CLIENT") {
      const clientCount = await tx.caseParty.count({
        where: { caseId, partyType: "CLIENT" }
      });
      if (clientCount <= 1) {
        throw appError("Cannot remove the last client party from a case", 422);
      }
    }

    await tx.caseParty.delete({ where: { id: partyId } });

    await writeAuditLog(tx, audit, {
      action: "cases.parties.delete",
      entityType: "CaseParty",
      entityId: partyId,
      oldData: { name: existing.name, role: existing.role, partyType: existing.partyType }
    });

    return getCaseRecord(actor, caseId);
  });
}


export async function addCaseAssignment(
  actor: SessionUser,
  caseId: string,
  payload: CreateCaseAssignmentDto,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.caseAssignment.findFirst({
      where: { caseId, userId: payload.userId, unassignedAt: null }
    });
    if (existing) {
      throw appError("User is already assigned to this case", 409);
    }

    const assignment = await tx.caseAssignment.create({
      data: {
        caseId,
        userId: payload.userId,
        roleOnCase: payload.roleOnCase as PrismaCaseRoleOnCase
      }
    });

    await writeAuditLog(tx, audit, {
      action: "cases.assignments.create",
      entityType: "CaseAssignment",
      entityId: assignment.id,
      newData: { caseId, userId: payload.userId, roleOnCase: payload.roleOnCase }
    });

    return getCaseRecord(actor, caseId);
  });
}

export async function unassignCase(
  actor: SessionUser,
  caseId: string,
  assignmentId: string,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    await tx.caseAssignment.update({
      where: { id: assignmentId },
      data: { unassignedAt: new Date() }
    });

    await writeAuditLog(tx, audit, {
      action: "cases.assignments.delete",
      entityType: "CaseAssignment",
      entityId: assignmentId,
      newData: { unassignedAt: new Date().toISOString() }
    });

    return getCaseRecord(actor, caseId);
  });
}

export async function listCaseStatusHistory(actor: SessionUser, caseId: string) {
  return getCaseRecord(actor, caseId);
}

export async function listCaseParties(
  actor: SessionUser,
  caseId: string,
  query: {
    q?: string;
    role?: string;
    partyType?: CasePartyType;
    sortBy?: string;
    sortDir?: SortDir;
    page: number;
    limit: number;
  }
) {
  const q = query.q?.trim();
  const searchCandidates = buildFuzzySearchCandidates(q);
  const sortBy = normalizeSort(query.sortBy, ["name", "role", "partyType", "createdAt"] as const, "createdAt");
  const sortDir = toPrismaSortOrder(query.sortDir ?? "desc");

  return withTenant(prisma, actor.firmId, async (tx) => {
    await tx.case.findFirstOrThrow({
      where: { id: caseId, firmId: actor.firmId, deletedAt: null }
    });

    const where: Prisma.CasePartyWhereInput = {
      caseId,
      ...(query.role ? { role: query.role } : {}),
      ...(query.partyType ? { partyType: query.partyType } : {}),
      ...(searchCandidates.length > 0
        ? {
            OR: searchCandidates.flatMap((candidate) => [
              {
                name: { contains: candidate, mode: "insensitive" as const }
              },
              {
                client: {
                  name: { contains: candidate, mode: "insensitive" as const }
                }
              }
            ])
          }
        : {})
    };

    const [items, total] = await Promise.all([
      tx.caseParty.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit
      }),
      tx.caseParty.count({ where })
    ]);

    return {
      items: items.map(mapCaseParty),
      total,
      page: query.page,
      pageSize: query.limit
    };
  });
}

export async function listCaseAssignments(
  actor: SessionUser,
  caseId: string,
  query: {
    q?: string;
    roleOnCase?: string;
    active?: string;
    sortBy?: string;
    sortDir?: SortDir;
    page: number;
    limit: number;
  }
) {
  const q = query.q?.trim();
  const searchCandidates = buildFuzzySearchCandidates(q);
  const sortBy = normalizeSort(query.sortBy, ["assignedAt", "unassignedAt", "roleOnCase", "userName"] as const, "assignedAt");
  const sortDir = toPrismaSortOrder(query.sortDir ?? "desc");

  return withTenant(prisma, actor.firmId, async (tx) => {
    await tx.case.findFirstOrThrow({
      where: { id: caseId, firmId: actor.firmId, deletedAt: null }
    });

    const where: Prisma.CaseAssignmentWhereInput = {
      caseId,
      ...(query.roleOnCase ? { roleOnCase: query.roleOnCase as PrismaCaseRoleOnCase } : {}),
      ...(query.active === "false" ? { unassignedAt: { not: null } } : { unassignedAt: null }),
      ...(searchCandidates.length > 0
        ? {
            OR: searchCandidates.map((candidate) => ({
              user: {
                fullName: {
                  contains: candidate,
                  mode: "insensitive" as const
                }
              }
            }))
          }
        : {})
    };
    const orderBy: Prisma.CaseAssignmentOrderByWithRelationInput =
      sortBy === "userName" ? { user: { fullName: sortDir } } : { [sortBy]: sortDir };

    const [items, total] = await Promise.all([
      tx.caseAssignment.findMany({
        where,
        select: {
          id: true,
          userId: true,
          roleOnCase: true,
          assignedAt: true,
          unassignedAt: true,
          user: { select: { fullName: true } }
        },
        orderBy,
        skip: (query.page - 1) * query.limit,
        take: query.limit
      }),
      tx.caseAssignment.count({ where })
    ]);

    return {
      items: items.map(mapCaseAssignment),
      total,
      page: query.page,
      pageSize: query.limit
    };
  });
}

// ── Court Progression ─────────────────────────────────────────────────────────

export async function listCaseCourts(
  actor: SessionUser,
  caseId: string,
  query: {
    q?: string;
    courtLevel?: string;
    isActive?: string;
    sortBy?: string;
    sortDir?: SortDir;
    page: number;
    limit: number;
  }
) {
  const q = query.q?.trim();
  const searchCandidates = buildFuzzySearchCandidates(q);
  const sortBy = normalizeSort(
    query.sortBy,
    ["stageOrder", "courtName", "courtLevel", "createdAt", "startedAt", "isActive"] as const,
    "stageOrder"
  );
  const sortDir = toPrismaSortOrder(query.sortDir ?? (sortBy === "stageOrder" ? "asc" : "desc"));

  return withTenant(prisma, actor.firmId, async (tx) => {
    // Verify case belongs to actor's firm
    await tx.case.findFirstOrThrow({
      where: { id: caseId, firmId: actor.firmId, deletedAt: null }
    });

    const where: Prisma.CaseCourtWhereInput = {
      caseId,
      ...(query.courtLevel ? { courtLevel: query.courtLevel } : {}),
      ...(query.isActive === "true" ? { isActive: true } : {}),
      ...(query.isActive === "false" ? { isActive: false } : {}),
      ...(searchCandidates.length > 0
        ? {
            OR: searchCandidates.flatMap((candidate) => [
              {
                courtName: {
                  contains: candidate,
                  mode: "insensitive" as const
                }
              },
              {
                caseNumber: {
                  contains: candidate,
                  mode: "insensitive" as const
                }
              },
              {
                circuit: {
                  contains: candidate,
                  mode: "insensitive" as const
                }
              },
              {
                notes: { contains: candidate, mode: "insensitive" as const }
              }
            ])
          }
        : {})
    };

    const [courts, total] = await Promise.all([
      tx.caseCourt.findMany({
        where,
        orderBy: { [sortBy]: sortDir },
        skip: (query.page - 1) * query.limit,
        take: query.limit
      }),
      tx.caseCourt.count({ where })
    ]);

    return {
      items: courts.map(mapCourt),
      total,
      page: query.page,
      pageSize: query.limit
    };
  });
}

export async function addCaseCourt(
  actor: SessionUser,
  caseId: string,
  payload: CreateCaseCourtDto,
  audit: AuditContext
): Promise<CaseCourtDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    await tx.case.findFirstOrThrow({
      where: { id: caseId, firmId: actor.firmId, deletedAt: null }
    });

    // Auto-increment stageOrder if not provided
    let stageOrder = payload.stageOrder;
    if (stageOrder === undefined) {
      const maxRow = await tx.caseCourt.aggregate({
        where: { caseId },
        _max: { stageOrder: true }
      });
      stageOrder = (maxRow._max.stageOrder ?? -1) + 1;
    }

    const court = await tx.caseCourt.create({
      data: {
        caseId,
        courtName: payload.courtName,
        courtLevel: payload.courtLevel,
        circuit: payload.circuit ?? null,
        caseNumber: payload.caseNumber ?? null,
        stageOrder,
        startedAt: payload.startedAt ? new Date(payload.startedAt) : null,
        notes: payload.notes ?? null,
        isActive: true
      }
    });

    await writeAuditLog(tx, audit, {
      action: "cases.courts.create",
      entityType: "CaseCourt",
      entityId: court.id,
      newData: { caseId, courtName: court.courtName, courtLevel: court.courtLevel }
    });

    return mapCourt(court);
  });
}

export async function updateCaseCourt(
  actor: SessionUser,
  caseId: string,
  courtId: string,
  payload: UpdateCaseCourtDto,
  audit: AuditContext
): Promise<CaseCourtDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    // Verify ownership
    await tx.caseCourt.findFirstOrThrow({
      where: { id: courtId, caseId, case: { firmId: actor.firmId } }
    });

    const court = await tx.caseCourt.update({
      where: { id: courtId },
      data: {
        courtName: payload.courtName,
        courtLevel: payload.courtLevel,
        circuit: payload.circuit ?? null,
        caseNumber: payload.caseNumber ?? null,
        startedAt: payload.startedAt ? new Date(payload.startedAt) : null,
        endedAt: payload.endedAt ? new Date(payload.endedAt) : null,
        isActive: payload.isActive,
        notes: payload.notes ?? null
      }
    });

    await writeAuditLog(tx, audit, {
      action: "cases.courts.update",
      entityType: "CaseCourt",
      entityId: courtId,
      newData: { courtName: court.courtName, isActive: court.isActive }
    });

    return mapCourt(court);
  });
}

export async function removeCaseCourt(
  actor: SessionUser,
  caseId: string,
  courtId: string,
  audit: AuditContext
): Promise<{ success: true }> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    await tx.caseCourt.findFirstOrThrow({
      where: { id: courtId, caseId, case: { firmId: actor.firmId } }
    });

    // Block deletion if this court has sessions linked to it
    const sessionCount = await tx.caseSession.count({
      where: { caseCourtId: courtId }
    });
    if (sessionCount > 0) {
      throw appError(
        `Cannot delete court stage with ${sessionCount} linked hearing(s). Unlink or move hearings first.`,
        422
      );
    }

    await tx.caseCourt.delete({ where: { id: courtId } });

    await writeAuditLog(tx, audit, {
      action: "cases.courts.delete",
      entityType: "CaseCourt",
      entityId: courtId,
      oldData: { caseId }
    });

    return { success: true as const };
  });
}

export async function reorderCaseCourts(
  actor: SessionUser,
  caseId: string,
  payload: ReorderCaseCourtsDto,
  audit: AuditContext
): Promise<CaseCourtDto[]> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    await tx.case.findFirstOrThrow({
      where: { id: caseId, firmId: actor.firmId, deletedAt: null }
    });

    await Promise.all(
      payload.orderedIds.map((courtId, index) =>
        tx.caseCourt.updateMany({
          where: { id: courtId, caseId },
          data: { stageOrder: index }
        })
      )
    );

    await writeAuditLog(tx, audit, {
      action: "cases.courts.reorder",
      entityType: "Case",
      entityId: caseId,
      newData: { orderedIds: payload.orderedIds }
    });

    const courts = await tx.caseCourt.findMany({
      where: { caseId },
      orderBy: { stageOrder: "asc" }
    });

    return courts.map(mapCourt);
  });
}
