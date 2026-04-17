import { InvitationStatus, type Prisma } from "@prisma/client";
import type { CreateInvitationDto } from "@elms/shared";
import type { RepositoryTx } from "../types.js";

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
  const where = {
    firmId,
    ...(query.status ? { status: query.status as InvitationStatus } : {}),
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { role: { name: { contains: q, mode: "insensitive" as const } } }
          ]
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
  invitationId: string
): Promise<InvitationRecord> {
  return tx.invitation.update({
    where: {
      id: invitationId
    },
    data: {
      status: InvitationStatus.REVOKED
    },
    include: INVITATION_INCLUDE
  });
}
