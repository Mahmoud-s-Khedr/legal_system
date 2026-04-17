import { SessionOutcome as PrismaSessionOutcome, type CaseSession, type Prisma } from "@prisma/client";
import type { RepositoryTx } from "../types.js";

const hearingInclude = {
  case: true
} as const;

export type HearingRecord = Prisma.CaseSessionGetPayload<{ include: typeof hearingInclude }>;

export async function findHearingConflicts(
  tx: RepositoryTx,
  firmId: string,
  assignedLawyerId: string,
  sessionDatetime: Date,
  excludeId?: string
): Promise<Array<{ id: string }>> {
  const start = new Date(sessionDatetime.getTime() - 60 * 60 * 1000);
  const end = new Date(sessionDatetime.getTime() + 60 * 60 * 1000);

  return tx.caseSession.findMany({
    where: {
      assignedLawyerId,
      case: { firmId, deletedAt: null },
      ...(excludeId ? { id: { not: excludeId } } : {}),
      sessionDatetime: { gte: start, lte: end }
    },
    select: { id: true }
  });
}

export async function upsertHearingEvent(
  tx: RepositoryTx,
  hearing: {
    id: string;
    caseId: string;
    sessionDatetime: Date;
    case: { title: string; firmId: string };
  }
): Promise<void> {
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

export async function listFirmHearings(
  tx: RepositoryTx,
  where: Prisma.CaseSessionWhereInput,
  orderBy: Prisma.CaseSessionOrderByWithRelationInput,
  pagination: { page: number; limit: number }
): Promise<{ total: number; items: HearingRecord[] }> {
  const { page, limit } = pagination;
  const [total, items] = await Promise.all([
    tx.caseSession.count({ where }),
    tx.caseSession.findMany({
      where,
      include: hearingInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  return { total, items };
}

export async function findFirmUsersByName(
  tx: RepositoryTx,
  firmId: string,
  q: string
): Promise<Array<{ id: string }>> {
  return tx.user.findMany({
    where: {
      firmId,
      deletedAt: null,
      fullName: { contains: q, mode: "insensitive" }
    },
    select: { id: true }
  });
}

export async function findFirmUserNamesByIds(
  tx: RepositoryTx,
  firmId: string,
  userIds: string[]
): Promise<Array<{ id: string; fullName: string }>> {
  if (userIds.length === 0) {
    return [];
  }

  return tx.user.findMany({
    where: { id: { in: userIds }, firmId, deletedAt: null },
    select: { id: true, fullName: true }
  });
}

export async function findFirmUserNameById(
  tx: RepositoryTx,
  firmId: string,
  userId: string
): Promise<{ fullName: string } | null> {
  return tx.user.findFirst({
    where: { id: userId, firmId, deletedAt: null },
    select: { fullName: true }
  });
}

export async function getFirmHearingByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  hearingId: string
): Promise<HearingRecord> {
  return tx.caseSession.findFirstOrThrow({
    where: {
      id: hearingId,
      case: {
        firmId,
        deletedAt: null
      }
    },
    include: hearingInclude
  });
}

export async function getFirmHearingRowByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  hearingId: string
): Promise<CaseSession> {
  return tx.caseSession.findFirstOrThrow({
    where: {
      id: hearingId,
      case: {
        firmId,
        deletedAt: null
      }
    }
  });
}

export async function createHearingRecord(
  tx: RepositoryTx,
  payload: {
    caseId: string;
    assignedLawyerId: string | null;
    sessionDatetime: Date;
    nextSessionAt: Date | null;
    outcome: PrismaSessionOutcome | null;
    notes: string | null;
  }
): Promise<HearingRecord> {
  return tx.caseSession.create({
    data: payload,
    include: hearingInclude
  });
}

export async function updateHearingRecordById(
  tx: RepositoryTx,
  hearingId: string,
  payload: {
    caseId: string;
    assignedLawyerId: string | null;
    sessionDatetime: Date;
    nextSessionAt: Date | null;
    outcome: PrismaSessionOutcome | null;
    notes: string | null;
  }
): Promise<HearingRecord> {
  return tx.caseSession.update({
    where: { id: hearingId },
    data: payload,
    include: hearingInclude
  });
}

export async function updateHearingOutcomeById(
  tx: RepositoryTx,
  hearingId: string,
  outcome: PrismaSessionOutcome | null
): Promise<HearingRecord> {
  return tx.caseSession.update({
    where: { id: hearingId },
    data: { outcome },
    include: hearingInclude
  });
}
