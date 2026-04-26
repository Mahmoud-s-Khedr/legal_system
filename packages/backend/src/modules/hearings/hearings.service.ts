import type {
  CreateHearingDto,
  HearingConflictDto,
  HearingDto,
  HearingListResponseDto,
  SessionOutcome,
  SessionUser,
  UpdateHearingOutcomeDto,
  UpdateHearingDto
} from "@elms/shared";
import { Prisma, SessionOutcome as PrismaSessionOutcome } from "@prisma/client";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";
import { buildFuzzySearchCandidates } from "../../utils/fuzzySearch.js";
import { appError } from "../../errors/appError.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  createHearingRecord,
  findFirmUserNameById,
  findFirmUserNamesByIds,
  findFirmUsersByName,
  findHearingConflicts,
  getFirmHearingByIdOrThrow,
  getFirmHearingRowByIdOrThrow,
  listFirmHearings,
  updateHearingOutcomeById,
  updateHearingRecordById,
  upsertHearingEvent,
  type HearingRecord
} from "../../repositories/hearings/hearings.repository.js";

function mapHearing(session: HearingRecord, assignedLawyerName: string | null = null): HearingDto {
  return {
    id: session.id,
    caseId: session.caseId,
    caseTitle: session.case.title,
    assignedLawyerId: session.assignedLawyerId,
    assignedLawyerName,
    sessionDatetime: session.sessionDatetime.toISOString(),
    nextSessionAt: session.nextSessionAt?.toISOString() ?? null,
    outcome: session.outcome as SessionOutcome | null,
    notes: session.notes,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  };
}

async function checkConflictInTx(
  tx: Prisma.TransactionClient,
  firmId: string,
  assignedLawyerId: string,
  sessionDatetime: Date,
  excludeId?: string
): Promise<string[]> {
  const conflicts = await findHearingConflicts(tx, firmId, assignedLawyerId, sessionDatetime, excludeId);

  return conflicts.map((c) => c.id);
}

async function syncEvent(
  tx: Prisma.TransactionClient,
  hearing: {
    id: string;
    caseId: string;
    sessionDatetime: Date;
    case: { title: string; firmId: string };
  }
) {
  await upsertHearingEvent(tx, hearing);
}

export async function listHearings(
  actor: SessionUser,
  filters: {
    q?: string;
    caseId?: string;
    assignedLawyerId?: string;
    overdue?: string;
    from?: string;
    to?: string;
    sortBy?: string;
    sortDir?: SortDir;
  },
  pagination: { page: number; limit: number }
): Promise<HearingListResponseDto> {
  const { page, limit } = pagination;
  const q = filters.q?.trim();
  const searchCandidates = buildFuzzySearchCandidates(q);
  const sortBy = normalizeSort(filters.sortBy, ["sessionDatetime", "createdAt", "outcome"] as const, "sessionDatetime");
  const sortDir = toPrismaSortOrder(filters.sortDir ?? "asc");

  return inTenantTransaction(actor.firmId, async (tx) => {
    const where: Prisma.CaseSessionWhereInput = {
      case: { firmId: actor.firmId, deletedAt: null },
      ...(filters.caseId ? { caseId: filters.caseId } : {}),
      ...(filters.assignedLawyerId ? { assignedLawyerId: filters.assignedLawyerId } : {}),
      ...buildSessionDatetimeFilter(filters)
    };

    if (searchCandidates.length > 0) {
      const matchedUsers = await findFirmUsersByName(tx, actor.firmId, q ?? "");
      const qUpper = (q ?? "").toUpperCase();
      const maybeOutcome =
        (Object.values(PrismaSessionOutcome) as string[]).includes(qUpper)
          ? (qUpper as PrismaSessionOutcome)
          : null;
      where.OR = [
        ...searchCandidates.flatMap((candidate) => [
          { case: { title: { contains: candidate, mode: "insensitive" as const } } },
          { notes: { contains: candidate, mode: "insensitive" as const } }
        ]),
        ...(matchedUsers.length > 0 ? [{ assignedLawyerId: { in: matchedUsers.map((user) => user.id) } }] : []),
        ...(maybeOutcome ? [{ outcome: maybeOutcome }] : [])
      ];
    }

    const { total, items } = await listFirmHearings(tx, where, { [sortBy]: sortDir }, { page, limit });

    const assignedLawyerIds = [...new Set(items.map((item) => item.assignedLawyerId).filter(Boolean))] as string[];
    const assignedLawyers = await findFirmUserNamesByIds(tx, actor.firmId, assignedLawyerIds);
    const assignedLawyerNameById = new Map(assignedLawyers.map((lawyer) => [lawyer.id, lawyer.fullName]));

    return {
      items: items.map((item) => mapHearing(item, item.assignedLawyerId ? (assignedLawyerNameById.get(item.assignedLawyerId) ?? null) : null)),
      total,
      page,
      pageSize: limit
    };
  });
}

async function ensureActiveCaseInFirm(
  tx: Prisma.TransactionClient,
  firmId: string,
  caseId: string
) {
  const caseRecord = await tx.case.findFirst({
    where: {
      id: caseId,
      firmId,
      deletedAt: null
    },
    select: { id: true }
  });

  if (!caseRecord) {
    throw appError("Case not found or archived/deleted", 404);
  }
}

export function buildSessionDatetimeFilter(filters: {
  from?: string;
  to?: string;
  overdue?: string;
}) {
  const sessionDatetime: { gte?: Date; lte?: Date; lt?: Date } = {};

  if (filters.overdue === "true") {
    sessionDatetime.lt = new Date();
  }

  if (filters.from) {
    sessionDatetime.gte = new Date(filters.from);
  }

  if (filters.to) {
    sessionDatetime.lte = new Date(filters.to);
  }

  return Object.keys(sessionDatetime).length ? { sessionDatetime } : {};
}

export async function getHearing(actor: SessionUser, hearingId: string): Promise<HearingDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const item = await getFirmHearingByIdOrThrow(tx, actor.firmId, hearingId);

    const assignedLawyer = item.assignedLawyerId
      ? await findFirmUserNameById(tx, actor.firmId, item.assignedLawyerId)
      : null;

    return mapHearing(item, assignedLawyer?.fullName ?? null);
  });
}

export async function createHearing(
  actor: SessionUser,
  payload: CreateHearingDto,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    await ensureActiveCaseInFirm(tx, actor.firmId, payload.caseId);

    const sessionDatetime = new Date(payload.sessionDatetime);

    if (payload.assignedLawyerId) {
      const conflictIds = await checkConflictInTx(tx, actor.firmId, payload.assignedLawyerId, sessionDatetime);
      if (conflictIds.length > 0) {
        throw appError("Hearing conflicts with an existing session for this lawyer", 409);
      }
    }

    const hearing = await createHearingRecord(tx, {
      caseId: payload.caseId,
      assignedLawyerId: payload.assignedLawyerId ?? null,
      sessionDatetime,
      nextSessionAt: payload.nextSessionAt ? new Date(payload.nextSessionAt) : null,
      outcome: (payload.outcome as PrismaSessionOutcome) ?? null,
      notes: payload.notes ?? null
    });

    await syncEvent(tx, hearing);

    await writeAuditLog(tx, audit, {
      action: "hearings.create",
      entityType: "CaseSession",
      entityId: hearing.id,
      newData: {
        caseId: hearing.caseId,
        sessionDatetime: hearing.sessionDatetime.toISOString()
      }
    });

    return mapHearing(hearing, null);
  });
}

export async function updateHearing(
  actor: SessionUser,
  hearingId: string,
  payload: UpdateHearingDto,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmHearingRowByIdOrThrow(tx, actor.firmId, hearingId);

    await ensureActiveCaseInFirm(tx, actor.firmId, payload.caseId);

    const sessionDatetime = new Date(payload.sessionDatetime);

    if (payload.assignedLawyerId) {
      const conflictIds = await checkConflictInTx(tx, actor.firmId, payload.assignedLawyerId, sessionDatetime, hearingId);
      if (conflictIds.length > 0) {
        throw appError("Hearing conflicts with an existing session for this lawyer", 409);
      }
    }

    const hearing = await updateHearingRecordById(tx, hearingId, {
      caseId: payload.caseId,
      assignedLawyerId: payload.assignedLawyerId ?? null,
      sessionDatetime,
      nextSessionAt: payload.nextSessionAt ? new Date(payload.nextSessionAt) : null,
      outcome: (payload.outcome as PrismaSessionOutcome) ?? null,
      notes: payload.notes ?? null
    });

    await syncEvent(tx, hearing);

    await writeAuditLog(tx, audit, {
      action: "hearings.update",
      entityType: "CaseSession",
      entityId: hearing.id,
      oldData: {
        sessionDatetime: existing.sessionDatetime.toISOString()
      },
      newData: {
        sessionDatetime: hearing.sessionDatetime.toISOString()
      }
    });

    return mapHearing(hearing, null);
  });
}

export async function checkHearingConflict(
  actor: SessionUser,
  params: {
    assignedLawyerId?: string;
    sessionDatetime?: string;
    excludeId?: string;
  }
): Promise<HearingConflictDto> {
  if (!params.assignedLawyerId || !params.sessionDatetime) {
    return {
      hasConflict: false,
      conflictingHearingIds: []
    };
  }

  const assignedLawyerId = params.assignedLawyerId;
  const sessionDatetime = new Date(params.sessionDatetime);

  return inTenantTransaction(actor.firmId, async (tx) => {
    const conflicts = await findHearingConflicts(
      tx,
      actor.firmId,
      assignedLawyerId,
      sessionDatetime,
      params.excludeId
    );

    return {
      hasConflict: conflicts.length > 0,
      conflictingHearingIds: conflicts.map((item) => item.id)
    };
  });
}

export async function updateHearingOutcome(
  actor: SessionUser,
  hearingId: string,
  payload: UpdateHearingOutcomeDto,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmHearingByIdOrThrow(tx, actor.firmId, hearingId);

    const hearing = await updateHearingOutcomeById(tx, hearingId, (payload.outcome as PrismaSessionOutcome) ?? null);

    await writeAuditLog(tx, audit, {
      action: "hearings.outcome.update",
      entityType: "CaseSession",
      entityId: hearing.id,
      oldData: {
        outcome: existing.outcome
      },
      newData: {
        outcome: hearing.outcome
      }
    });

    return mapHearing(hearing, null);
  });
}
