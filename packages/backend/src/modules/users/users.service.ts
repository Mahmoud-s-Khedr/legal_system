import type {
  AdminSetPasswordDto,
  ChangeOwnPasswordDto,
  CreateLocalUserDto,
  SessionUser,
  UpdateUserDto,
  UpdateUserStatusDto,
  UserDto,
  UserListResponseDto
} from "@elms/shared";
import { UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { assertCanCreateLocalUser } from "../editions/editionPolicy.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";
import { appError } from "../../errors/appError.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  createFirmUser,
  getFirmActiveUserByIdOrThrow,
  getFirmActiveUserRowByIdOrThrow,
  listFirmUsers,
  softDeleteUserById,
  updateFirmUserById,
  updateFirmUserStatusById,
  updateUserPasswordHashById
} from "../../repositories/users/users.repository.js";
import {
  toSessionUser,
  type UserWithRole
} from "../auth/sessionUser.js";

function mapUser(user: UserWithRole): UserDto {
  const sessionUser = toSessionUser(user);
  return {
    ...sessionUser,
    status: user.status,
    createdAt: user.createdAt.toISOString()
  };
}

export async function listUsers(
  actor: SessionUser,
  query: {
    q?: string;
    status?: string;
    roleId?: string;
    sortBy?: string;
    sortDir?: SortDir;
    page?: number;
    limit?: number;
  } = { page: 1, limit: 50 }
): Promise<UserListResponseDto> {
  const page = query.page ?? 1;
  const limit = query.limit ?? 50;
  const sortBy = normalizeSort(query.sortBy, ["fullName", "email", "createdAt", "status"] as const, "createdAt");
  const sortDir = toPrismaSortOrder(query.sortDir ?? "desc");

  return inTenantTransaction(actor.firmId, async (tx) => {
    const { total, items } = await listFirmUsers(tx, actor.firmId, {
      q: query.q,
      status: query.status,
      roleId: query.roleId,
      sortBy,
      sortDir,
      page,
      limit
    });

    return {
      items: items.map(mapUser),
      total,
      page,
      pageSize: limit
    };
  });
}

export async function getUser(actor: SessionUser, userId: string): Promise<UserDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const user = await getFirmActiveUserByIdOrThrow(tx, actor.firmId, userId);

    return mapUser(user);
  });
}

export async function createLocalUser(
  actor: SessionUser,
  payload: CreateLocalUserDto,
  audit: AuditContext
): Promise<UserDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    await assertCanCreateLocalUser(tx, actor);

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await createFirmUser(tx, actor.firmId, payload, passwordHash);

    await writeAuditLog(tx, audit, {
      action: "users.create",
      entityType: "User",
      entityId: user.id,
      newData: {
        email: user.email,
        fullName: user.fullName,
        roleId: user.roleId
      }
    });

    return mapUser(user);
  });
}

function httpError(message: string, statusCode: number) {
  return appError(message, statusCode);
}

export async function updateUser(
  actor: SessionUser,
  userId: string,
  payload: UpdateUserDto,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const canManageUsers = actor.permissions.includes("users:update");
    const existing = await getFirmActiveUserRowByIdOrThrow(tx, actor.firmId, userId);

    if (actor.id !== userId && !canManageUsers) {
      throw httpError("You do not have permission to update this user", 403);
    }

    const user = await updateFirmUserById(tx, userId, payload, {
      roleId: canManageUsers ? payload.roleId : existing.roleId,
      status: canManageUsers
        ? (payload.status as UserStatus | undefined) ?? existing.status
        : existing.status
    });

    await writeAuditLog(tx, audit, {
      action: "users.update",
      entityType: "User",
      entityId: user.id,
      oldData: {
        fullName: existing.fullName,
        email: existing.email,
        roleId: existing.roleId,
        status: existing.status
      },
      newData: {
        fullName: user.fullName,
        email: user.email,
        roleId: user.roleId,
        status: user.status
      }
    });

    return mapUser(user);
  });
}

export async function changeOwnPassword(
  actor: SessionUser,
  payload: ChangeOwnPasswordDto,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const user = await getFirmActiveUserRowByIdOrThrow(tx, actor.firmId, actor.id);

    if (!user.passwordHash) {
      throw httpError("Password update is unavailable for this account", 400);
    }

    const isValid = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!isValid) {
      throw httpError("Current password is incorrect", 400);
    }

    const passwordHash = await bcrypt.hash(payload.newPassword, 12);
    await updateUserPasswordHashById(tx, user.id, passwordHash);

    await writeAuditLog(tx, audit, {
      action: "users.change_password",
      entityType: "User",
      entityId: user.id
    });

    return { success: true as const };
  });
}

export async function adminSetPassword(
  actor: SessionUser,
  userId: string,
  payload: AdminSetPasswordDto,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    if (!actor.permissions.includes("users:update")) {
      throw httpError("You do not have permission to update user passwords", 403);
    }

    const user = await getFirmActiveUserRowByIdOrThrow(tx, actor.firmId, userId);

    const passwordHash = await bcrypt.hash(payload.newPassword, 12);
    await updateUserPasswordHashById(tx, user.id, passwordHash);

    await writeAuditLog(tx, audit, {
      action: "users.admin_set_password",
      entityType: "User",
      entityId: user.id,
      newData: {
        by: actor.id
      }
    });

    return { success: true as const };
  });
}

export async function updateUserStatus(
  actor: SessionUser,
  userId: string,
  payload: UpdateUserStatusDto,
  audit: AuditContext
) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    if (!actor.permissions.includes("users:update")) {
      throw httpError("You do not have permission to change user status", 403);
    }

    if (actor.id === userId && payload.status !== UserStatus.ACTIVE) {
      throw httpError("You cannot deactivate your own account", 400);
    }

    const existing = await getFirmActiveUserRowByIdOrThrow(tx, actor.firmId, userId);

    const nextStatus = payload.status as UserStatus;

    const user = await updateFirmUserStatusById(tx, userId, nextStatus);

    await writeAuditLog(tx, audit, {
      action: "users.status",
      entityType: "User",
      entityId: user.id,
      oldData: { status: existing.status },
      newData: { status: user.status }
    });

    return mapUser(user);
  });
}

export async function removeUser(actor: SessionUser, userId: string, audit: AuditContext) {
  return inTenantTransaction(actor.firmId, async (tx) => {
    if (!actor.permissions.includes("users:delete")) {
      throw httpError("You do not have permission to delete users", 403);
    }

    if (actor.id === userId) {
      throw httpError("You cannot delete your own account", 400);
    }

    const existing = await getFirmActiveUserRowByIdOrThrow(tx, actor.firmId, userId);
    await softDeleteUserById(tx, userId);

    await writeAuditLog(tx, audit, {
      action: "users.delete",
      entityType: "User",
      entityId: userId,
      oldData: {
        fullName: existing.fullName,
        email: existing.email,
        status: existing.status
      }
    });

    return { success: true as const };
  });
}
