import type {
  CreateInvitationDto,
  InvitationDto,
  InvitationListResponseDto,
  SessionUser
} from "@elms/shared";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { createInvitationToken } from "../auth/inviteToken.js";
import { assertCanCreateInvitation } from "../editions/editionPolicy.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  createFirmInvitation,
  getFirmInvitationByIdOrThrow,
  listFirmInvitations,
  markInvitationRevokedById,
  type InvitationRecord
} from "../../repositories/invitations/invitations.repository.js";

function mapInvitation(invitation: InvitationRecord): InvitationDto {
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
  query: {
    q?: string;
    status?: string;
    sortBy?: string;
    sortDir?: SortDir;
    page?: number;
    limit?: number;
  } = { page: 1, limit: 50 }
): Promise<InvitationListResponseDto> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const sortBy = normalizeSort(query.sortBy, ["createdAt", "expiresAt", "email", "status"] as const, "createdAt");
  const sortDir = toPrismaSortOrder(query.sortDir ?? "desc");

  return inTenantTransaction(actor.firmId, async (tx) => {
    const { total, items } = await listFirmInvitations(tx, actor.firmId, {
      q: query.q,
      status: query.status,
      sortBy,
      sortDir,
      page,
      limit
    });

    return {
      items: items.map(mapInvitation),
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
  return inTenantTransaction(actor.firmId, async (tx) => {
    await assertCanCreateInvitation(tx, actor);

    const invitation = await createFirmInvitation(
      tx,
      actor.firmId,
      actor.id,
      payload,
      createInvitationToken(),
      new Date(Date.now() + 48 * 60 * 60 * 1000)
    );

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmInvitationByIdOrThrow(tx, actor.firmId, invitationId);

    const invitation = await markInvitationRevokedById(tx, invitationId);

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
