import type {
  CreateInvitationDto,
  InvitationDto,
  InvitationListResponseDto,
  SessionUser
} from "@elms/shared";
import { InvitationStatus } from "@prisma/client";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { createInvitationToken } from "../auth/inviteToken.js";
import { assertCanCreateInvitation } from "../editions/editionPolicy.js";

function mapInvitation(invitation: {
  id: string;
  email: string;
  token: string;
  status: InvitationStatus;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
  roleId: string;
  role: { name: string };
}): InvitationDto {
  return {
    id: invitation.id,
    roleId: invitation.roleId,
    roleName: invitation.role.name,
    email: invitation.email,
    token: invitation.token,
    status: invitation.status,
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString()
  };
}

export async function listInvitations(
  actor: SessionUser,
  pagination: { page: number; limit: number } = { page: 1, limit: 50 }
): Promise<InvitationListResponseDto> {
  const { page, limit } = pagination;
  return withTenant(prisma, actor.firmId, async (tx) => {
    const where = {
      firmId: actor.firmId
    };

    const [total, invitations] = await Promise.all([
      tx.invitation.count({ where }),
      tx.invitation.findMany({
        where,
        include: {
          role: true
        },
        orderBy: {
          createdAt: "desc"
        },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return {
      items: invitations.map(mapInvitation),
      total,
      page,
      pageSize: limit
    };
  });
}

export async function createInvitation(
  actor: SessionUser,
  payload: CreateInvitationDto,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    await assertCanCreateInvitation(tx, actor);

    const invitation = await tx.invitation.create({
      data: {
        firmId: actor.firmId,
        roleId: payload.roleId,
        invitedById: actor.id,
        email: payload.email,
        token: createInvitationToken(),
        expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        status: InvitationStatus.PENDING
      },
      include: {
        role: true
      }
    });

    await writeAuditLog(tx, audit, {
      action: "invitations.create",
      entityType: "Invitation",
      entityId: invitation.id,
      newData: {
        email: invitation.email,
        roleId: invitation.roleId,
        status: invitation.status
      }
    });

    return mapInvitation(invitation);
  });
}

export async function revokeInvitation(
  actor: SessionUser,
  invitationId: string,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.invitation.findFirstOrThrow({
      where: {
        id: invitationId,
        firmId: actor.firmId
      },
      include: {
        role: true
      }
    });

    const invitation = await tx.invitation.update({
      where: {
        id: invitationId
      },
      data: {
        status: InvitationStatus.REVOKED
      },
      include: {
        role: true
      }
    });

    await writeAuditLog(tx, audit, {
      action: "invitations.revoke",
      entityType: "Invitation",
      entityId: invitation.id,
      oldData: {
        status: existing.status
      },
      newData: {
        status: invitation.status
      }
    });

    return mapInvitation(invitation);
  });
}
