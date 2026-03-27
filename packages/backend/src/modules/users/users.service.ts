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
import { Language, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { assertCanCreateLocalUser } from "../editions/editionPolicy.js";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";
import {
  toSessionUser,
  type UserWithRole,
  userWithRoleInclude
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
  const q = query.q?.trim();
  const sortBy = normalizeSort(query.sortBy, ["fullName", "email", "createdAt", "status"] as const, "createdAt");
  const sortDir = toPrismaSortOrder(query.sortDir ?? "desc");

  return withTenant(prisma, actor.firmId, async (tx) => {
    const where = {
      firmId: actor.firmId,
      deletedAt: null,
      ...(query.status ? { status: query.status as UserStatus } : {}),
      ...(query.roleId ? { roleId: query.roleId } : {}),
      ...(q
        ? {
            OR: [
              { fullName: { contains: q, mode: "insensitive" as const } },
              { email: { contains: q, mode: "insensitive" as const } }
            ]
          }
        : {})
    };

    const [total, users] = await Promise.all([
      tx.user.count({ where }),
      tx.user.findMany({
        where,
        include: userWithRoleInclude,
        orderBy: { [sortBy]: sortDir },
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return {
      items: users.map(mapUser),
      total,
      page,
      pageSize: limit
    };
  });
}

export async function getUser(actor: SessionUser, userId: string): Promise<UserDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const user = await tx.user.findFirstOrThrow({
      where: {
        id: userId,
        firmId: actor.firmId,
        deletedAt: null
      },
      include: userWithRoleInclude
    });

    return mapUser(user);
  });
}

export async function createLocalUser(
  actor: SessionUser,
  payload: CreateLocalUserDto,
  audit: AuditContext
): Promise<UserDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    await assertCanCreateLocalUser(tx, actor);

    const passwordHash = await bcrypt.hash(payload.password, 12);
    const user = await tx.user.create({
      data: {
        firmId: actor.firmId,
        roleId: payload.roleId,
        email: payload.email,
        fullName: payload.fullName,
        passwordHash,
        preferredLanguage: (payload.preferredLanguage as Language | undefined) ?? Language.AR,
        status: UserStatus.ACTIVE
      },
      include: userWithRoleInclude
    });

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
  const error = new Error(message) as Error & { statusCode: number };
  error.statusCode = statusCode;
  return error;
}

export async function updateUser(
  actor: SessionUser,
  userId: string,
  payload: UpdateUserDto,
  audit: AuditContext
) {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const canManageUsers = actor.permissions.includes("users:update");
    const existing = await tx.user.findFirstOrThrow({
      where: {
        id: userId,
        firmId: actor.firmId,
        deletedAt: null
      }
    });

    if (actor.id !== userId && !canManageUsers) {
      throw httpError("You do not have permission to update this user", 403);
    }

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        fullName: payload.fullName,
        email: payload.email,
        roleId: canManageUsers ? payload.roleId : existing.roleId,
        preferredLanguage: (payload.preferredLanguage as Language | undefined) ?? Language.AR,
        status: canManageUsers
          ? (payload.status as UserStatus | undefined) ?? existing.status
          : existing.status
      },
      include: userWithRoleInclude
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
  return withTenant(prisma, actor.firmId, async (tx) => {
    const user = await tx.user.findFirstOrThrow({
      where: {
        id: actor.id,
        firmId: actor.firmId,
        deletedAt: null
      }
    });

    if (!user.passwordHash) {
      throw httpError("Password update is unavailable for this account", 400);
    }

    const isValid = await bcrypt.compare(payload.currentPassword, user.passwordHash);
    if (!isValid) {
      throw httpError("Current password is incorrect", 400);
    }

    const passwordHash = await bcrypt.hash(payload.newPassword, 12);
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

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
  return withTenant(prisma, actor.firmId, async (tx) => {
    if (!actor.permissions.includes("users:update")) {
      throw httpError("You do not have permission to update user passwords", 403);
    }

    const user = await tx.user.findFirstOrThrow({
      where: {
        id: userId,
        firmId: actor.firmId,
        deletedAt: null
      }
    });

    const passwordHash = await bcrypt.hash(payload.newPassword, 12);
    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash }
    });

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
  return withTenant(prisma, actor.firmId, async (tx) => {
    if (!actor.permissions.includes("users:update")) {
      throw httpError("You do not have permission to change user status", 403);
    }

    if (actor.id === userId && payload.status !== UserStatus.ACTIVE) {
      throw httpError("You cannot deactivate your own account", 400);
    }

    const existing = await tx.user.findFirstOrThrow({
      where: {
        id: userId,
        firmId: actor.firmId,
        deletedAt: null
      }
    });

    const nextStatus = payload.status as UserStatus;

    const user = await tx.user.update({
      where: { id: userId },
      data: {
        status: nextStatus
      },
      include: userWithRoleInclude
    });

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
  return withTenant(prisma, actor.firmId, async (tx) => {
    if (!actor.permissions.includes("users:delete")) {
      throw httpError("You do not have permission to delete users", 403);
    }

    if (actor.id === userId) {
      throw httpError("You cannot delete your own account", 400);
    }

    const existing = await tx.user.findFirstOrThrow({
      where: {
        id: userId,
        firmId: actor.firmId,
        deletedAt: null
      }
    });

    await tx.user.update({
      where: { id: userId },
      data: {
        status: UserStatus.SUSPENDED,
        deletedAt: new Date()
      }
    });

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
