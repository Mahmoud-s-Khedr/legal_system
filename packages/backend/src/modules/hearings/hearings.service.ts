import type {
  CreateHearingDto,
  HearingConflictDto,
  HearingDto,
  HearingListResponseDto,
  SessionOutcome,
  SessionUser,
  UpdateHearingDto
} from "@elms/shared";
import { SessionOutcome as PrismaSessionOutcome } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";

function mapHearing(session: {
  id: string;
  caseId: string;
  assignedLawyerId: string | null;
  sessionDatetime: Date;
  nextSessionAt: Date | null;
  outcome: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  case: { title: string };
}): HearingDto {
  return {
    id: session.id,
    caseId: session.caseId,
    caseTitle: session.case.title,
    assignedLawyerId: session.assignedLawyerId,
    assignedLawyerName: null,
    sessionDatetime: session.sessionDatetime.toISOString(),
    nextSessionAt: session.nextSessionAt?.toISOString() ?? null,
    outcome: session.outcome as SessionOutcome | null,
    notes: session.notes,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString()
  };
}

async function checkConflictInTx(
  tx: Parameters<Parameters<typeof withTenant>[2]>[0],
  firmId: string,
  assignedLawyerId: string,
  sessionDatetime: Date,
  excludeId?: string
): Promise<string[]> {
  const start = new Date(sessionDatetime.getTime() - 60 * 60 * 1000);
  const end = new Date(sessionDatetime.getTime() + 60 * 60 * 1000);

  const conflicts = await tx.caseSession.findMany({
    where: {
      assignedLawyerId,
      case: { firmId, deletedAt: null },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      sessionDatetime: { gte: start, lte: end }
    },
    select: { id: true }
  });

  return conflicts.map((c) => c.id);
}

async function syncEvent(
  tx: Parameters<Parameters<typeof withTenant>[2]>[0],
  hearing: {
    id: string;
    caseId: string;
    sessionDatetime: Date;
    case: { title: string; firmId: string };
  }
) {
  const endsAt = new Date(hearing.sessionDatetime.getTime() + 60 * 60 * 1000);
  await tx.event.upsert({
    where: {
      sessionId: hearing.id
    },
    update: {
      caseId: hearing.caseId,
      title: `Hearing: ${hearing.case.title}`,
      startsAt: hearing.sessionDatetime,
      endsAt
    },
    create: {
      firmId: hearing.case.firmId,
      caseId: hearing.caseId,
      sessionId: hearing.id,
      title: `Hearing: ${hearing.case.title}`,
      startsAt: hearing.sessionDatetime,
      endsAt
    }
  });
}

export async function listHearings(
  actor: SessionUser,
  filters: {
    caseId?: string;
    assignedLawyerId?: string;
    overdue?: string;
    from?: string;
    to?: string;
  },
  pagination: { page: number; limit: number }
): Promise<HearingListResponseDto> {
  const { page, limit } = pagination;
  return withTenant(prisma, actor.firmId, async (tx) => {
    const where = {
      case: { firmId: actor.firmId, deletedAt: null },
      ...(filters.caseId ? { caseId: filters.caseId } : {}),
      ...(filters.assignedLawyerId ? { assignedLawyerId: filters.assignedLawyerId } : {}),
      ...buildSessionDatetimeFilter(filters)
    };

    const [total, items] = await Promise.all([
      tx.caseSession.count({ where }),
      tx.caseSession.findMany({
        where,
        include: { case: true },
        orderBy: { sessionDatetime: "asc" },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return { items: items.map(mapHearing), total, page, pageSize: limit };
  });
}

export function buildSessionDatetimeFilter(filters: { from?: string; to?: string }) {
  const sessionDatetime: { gte?: Date; lte?: Date } = {};

  if (filters.from) {
    sessionDatetime.gte = new Date(filters.from);
  }

  if (filters.to) {
    sessionDatetime.lte = new Date(filters.to);
  }

  return Object.keys(sessionDatetime).length ? { sessionDatetime } : {};
}

export async function getHearing(actor: SessionUser, hearingId: string): Promise<HearingDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const item = await tx.caseSession.findFirstOrThrow({
      where: {
        id: hearingId,
        case: {
          firmId: actor.firmId,
          deletedAt: null
        }
      },
      include: {
        case: true
      }
    });

    return mapHearing(item);
  });
}

export async function createHearing(
  actor: SessionUser,
  payload: CreateHearingDto,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const sessionDatetime = new Date(payload.sessionDatetime);

    if (payload.assignedLawyerId) {
      const conflictIds = await checkConflictInTx(tx, actor.firmId, payload.assignedLawyerId, sessionDatetime);
      if (conflictIds.length > 0) {
        const err = new Error("Hearing conflicts with an existing session for this lawyer") as Error & { statusCode: number };
        err.statusCode = 409;
        throw err;
      }
    }

    const hearing = await tx.caseSession.create({
      data: {
        caseId: payload.caseId,
        assignedLawyerId: payload.assignedLawyerId ?? null,
        sessionDatetime,
        nextSessionAt: payload.nextSessionAt ? new Date(payload.nextSessionAt) : null,
        outcome: (payload.outcome as PrismaSessionOutcome) ?? null,
        notes: payload.notes ?? null
      },
      include: {
        case: true
      }
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

    return mapHearing(hearing);
  });
}

export async function updateHearing(
  actor: SessionUser,
  hearingId: string,
  payload: UpdateHearingDto,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.caseSession.findFirstOrThrow({
      where: {
        id: hearingId,
        case: {
          firmId: actor.firmId,
          deletedAt: null
        }
      }
    });

    const sessionDatetime = new Date(payload.sessionDatetime);

    if (payload.assignedLawyerId) {
      const conflictIds = await checkConflictInTx(tx, actor.firmId, payload.assignedLawyerId, sessionDatetime, hearingId);
      if (conflictIds.length > 0) {
        const err = new Error("Hearing conflicts with an existing session for this lawyer") as Error & { statusCode: number };
        err.statusCode = 409;
        throw err;
      }
    }

    const hearing = await tx.caseSession.update({
      where: { id: hearingId },
      data: {
        caseId: payload.caseId,
        assignedLawyerId: payload.assignedLawyerId ?? null,
        sessionDatetime,
        nextSessionAt: payload.nextSessionAt ? new Date(payload.nextSessionAt) : null,
        outcome: (payload.outcome as PrismaSessionOutcome) ?? null,
        notes: payload.notes ?? null
      },
      include: {
        case: true
      }
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

    return mapHearing(hearing);
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

  return withTenant(prisma, actor.firmId, async (tx) => {
    const target = new Date(params.sessionDatetime!);
    const start = new Date(target.getTime() - 60 * 60 * 1000);
    const end = new Date(target.getTime() + 60 * 60 * 1000);

    const conflicts = await tx.caseSession.findMany({
      where: {
        assignedLawyerId: params.assignedLawyerId,
        case: {
          firmId: actor.firmId,
          deletedAt: null
        },
        ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
        sessionDatetime: {
          gte: start,
          lte: end
        }
      },
      select: {
        id: true
      }
    });

    return {
      hasConflict: conflicts.length > 0,
      conflictingHearingIds: conflicts.map((item) => item.id)
    };
  });
}
