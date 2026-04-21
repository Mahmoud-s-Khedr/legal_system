import { InvitationStatus, type Prisma } from "@prisma/client";
import type { CreateInvitationDto } from "@elms/shared";
import type { RepositoryTx } from "../types.js";
import { buildFuzzySearchCandidates } from "../../utils/fuzzySearch.js";

const INVITATION_INCLUDE = {
  role: true
} as const;

export type InvitationRecord = Prisma.InvitationGetPayload<{ include: typeof INVITATION_INCLUDE }>;

type InvitationSortBy = "createdAt" | "expiresAt" | "email" | "status";

export type InvitationListQuery = {
  q?: string;
  status?: string;
  sortBy: InvitationSortBy;
  sortDir: Prisma.SortOrder;
  page: number;
  limit: number;
};

export async function listFirmInvitations(
  tx: RepositoryTx,
  firmId: string,
  query: InvitationListQuery
): Promise<{ total: number; items: InvitationRecord[] }> {
  const q = query.q?.trim();
  const searchCandidates = buildFuzzySearchCandidates(q);
  const where = {
    firmId,
    ...(query.status ? { status: query.status as InvitationStatus } : {}),
    ...(searchCandidates.length > 0
      ? {
          OR: searchCandidates.flatMap((candidate) => [
            { email: { contains: candidate, mode: "insensitive" as const } },
            {
              role: {
                name: { contains: candidate, mode: "insensitive" as const }
              }
            }
          ])
        }
      : {})
  };

  const [total, items] = await Promise.all([
    tx.invitation.count({ where }),
    tx.invitation.findMany({
      where,
      include: INVITATION_INCLUDE,
      orderBy: { [query.sortBy]: query.sortDir },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    })
  ]);

  return { total, items };
}

export async function createFirmInvitation(
  tx: RepositoryTx,
  firmId: string,
  invitedById: string,
  payload: CreateInvitationDto,
  token: string,
  expiresAt: Date
): Promise<InvitationRecord> {
  return tx.invitation.create({
    data: {
      firmId,
      roleId: payload.roleId,
      invitedById,
      email: payload.email,
      token,
      expiresAt,
      status: InvitationStatus.PENDING
    },
    include: INVITATION_INCLUDE
  });
}

export async function getFirmInvitationByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  invitationId: string
): Promise<InvitationRecord> {
  return tx.invitation.findFirstOrThrow({
    where: {
      id: invitationId,
      firmId
    },
    include: INVITATION_INCLUDE
  });
}

export async function markInvitationRevokedById(
  tx: RepositoryTx,
  firmId: string,
  invitationId: string
): Promise<InvitationRecord> {
  await tx.invitation.updateMany({
    where: {
      id: invitationId,
      firmId
    },
    data: {
      status: InvitationStatus.REVOKED
    }
  });

  return tx.invitation.findFirstOrThrow({
    where: {
      id: invitationId,
      firmId
    },
    include: INVITATION_INCLUDE
  });
}
