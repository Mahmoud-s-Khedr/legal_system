import type {
  CreateRoleDto,
  RoleDto,
  RoleListResponseDto,
  SessionUser,
  SetRolePermissionsDto,
  UpdateRoleDto
} from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { appError } from "../../errors/appError.js";

function mapRole(role: {
  id: string;
  firmId: string | null;
  key: string;
  name: string;
  scope: string;
  permissions: Array<{ permission: { key: string } }>;
}): RoleDto {
  return {
    id: role.id,
    firmId: role.firmId,
    key: role.key,
    name: role.name,
    scope: role.scope,
    permissions: role.permissions.map((item) => item.permission.key)
  };
}

const ROLE_INCLUDE = {
  permissions: {
    include: { permission: true }
  }
} as const;

async function resolvePermissionIds(
  tx: Parameters<Parameters<typeof withTenant>[2]>[0],
  permissionKeys: string[]
) {
  const uniqueKeys = [...new Set(permissionKeys)];
  if (uniqueKeys.length === 0) {
    return { ids: [], keys: [] };
  }

  const permissions = await tx.permission.findMany({
    where: { key: { in: uniqueKeys } }
  });

  const unknownKeys = uniqueKeys.filter(
    (key) => !permissions.some((permission) => permission.key === key)
  );
  if (unknownKeys.length > 0) {
    throw appError(`Unknown permission key(s): ${unknownKeys.join(", ")}`, 400);
  }

  return {
    ids: permissions.map((permission) => permission.id),
    keys: permissions.map((permission) => permission.key)
  };
}

export async function listRoles(
  actor: SessionUser,
  pagination: { page: number; limit: number } = { page: 1, limit: 50 }
): Promise<RoleListResponseDto> {
  const { page, limit } = pagination;
  return withTenant(prisma, actor.firmId, async (tx) => {
    const where = { OR: [{ firmId: null }, { firmId: actor.firmId }] };

    const [total, roles] = await Promise.all([
      tx.role.count({ where }),
      tx.role.findMany({
        where,
        include: ROLE_INCLUDE,
        orderBy: [{ scope: "asc" }, { name: "asc" }],
        skip: (page - 1) * limit,
        take: limit
      })
    ]);

    return { items: roles.map(mapRole), total, page, pageSize: limit };
  });
}

export async function getRole(actor: SessionUser, roleId: string): Promise<RoleDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const role = await tx.role.findFirstOrThrow({
      where: { id: roleId, OR: [{ firmId: null }, { firmId: actor.firmId }] },
      include: ROLE_INCLUDE
    });

    return mapRole(role);
  });
}

export async function createRole(
  actor: SessionUser,
  payload: CreateRoleDto,
  audit: AuditContext
): Promise<RoleDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.role.findFirst({
      where: { firmId: actor.firmId, key: payload.key }
    });
    if (existing) {
      throw appError(`A role with key "${payload.key}" already exists for this firm`, 409);
    }

    const role = await tx.role.create({
      data: {
        firmId: actor.firmId,
        key: payload.key,
        name: payload.name,
        scope: "FIRM"
      },
      include: ROLE_INCLUDE
    });

    if (payload.permissionKeys) {
      const resolved = await resolvePermissionIds(tx, payload.permissionKeys);
      if (resolved.ids.length > 0) {
        await tx.rolePermission.createMany({
          data: resolved.ids.map((permissionId) => ({ roleId: role.id, permissionId }))
        });
      }
    }

    const roleWithPermissions = await tx.role.findFirstOrThrow({
      where: { id: role.id },
      include: ROLE_INCLUDE
    });

    await writeAuditLog(tx, audit, {
      action: "roles.create",
      entityType: "Role",
      entityId: role.id,
      newData: {
        key: payload.key,
        name: payload.name,
        permissionKeys: payload.permissionKeys ?? []
      }
    });

    return mapRole(roleWithPermissions);
  });
}

export async function updateRole(
  actor: SessionUser,
  roleId: string,
  payload: UpdateRoleDto,
  audit: AuditContext
): Promise<RoleDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.role.findFirstOrThrow({
      where: { id: roleId, firmId: actor.firmId }
    });

    if (existing.scope === "SYSTEM") {
      throw appError("System roles cannot be modified", 403);
    }

    const role = await tx.role.update({
      where: { id: roleId },
      data: { name: payload.name },
      include: ROLE_INCLUDE
    });

    if (payload.permissionKeys) {
      const resolved = await resolvePermissionIds(tx, payload.permissionKeys);
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (resolved.ids.length > 0) {
        await tx.rolePermission.createMany({
          data: resolved.ids.map((permissionId) => ({ roleId, permissionId }))
        });
      }
    }

    const roleWithPermissions = await tx.role.findFirstOrThrow({
      where: { id: roleId },
      include: ROLE_INCLUDE
    });

    await writeAuditLog(tx, audit, {
      action: "roles.update",
      entityType: "Role",
      entityId: roleId,
      oldData: { name: existing.name },
      newData: {
        name: payload.name,
        permissionKeys: payload.permissionKeys ?? role.permissions.map((item) => item.permission.key)
      }
    });

    return mapRole(roleWithPermissions);
  });
}

export async function deleteRole(
  actor: SessionUser,
  roleId: string,
  audit: AuditContext
): Promise<{ success: true }> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.role.findFirstOrThrow({
      where: { id: roleId, firmId: actor.firmId }
    });

    if (existing.scope === "SYSTEM") {
      throw appError("System roles cannot be deleted", 403);
    }

    const userCount = await tx.user.count({ where: { roleId } });
    if (userCount > 0) {
      throw appError(`Cannot delete a role with ${userCount} assigned user(s). Reassign users first.`, 422);
    }

    await tx.role.delete({ where: { id: roleId } });

    await writeAuditLog(tx, audit, {
      action: "roles.delete",
      entityType: "Role",
      entityId: roleId,
      oldData: { key: existing.key, name: existing.name }
    });

    return { success: true as const };
  });
}

export async function setRolePermissions(
  actor: SessionUser,
  roleId: string,
  payload: SetRolePermissionsDto,
  audit: AuditContext
): Promise<RoleDto> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const existing = await tx.role.findFirstOrThrow({
      where: { id: roleId, firmId: actor.firmId }
    });

    if (existing.scope === "SYSTEM") {
      throw appError("System role permissions cannot be modified via this endpoint", 403);
    }

    const resolved = await resolvePermissionIds(tx, payload.permissionKeys);

    // Replace all permissions atomically
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (resolved.ids.length > 0) {
      await tx.rolePermission.createMany({
        data: resolved.ids.map((permissionId) => ({ roleId, permissionId }))
      });
    }

    await writeAuditLog(tx, audit, {
      action: "roles.permissions.set",
      entityType: "Role",
      entityId: roleId,
      newData: { permissionKeys: resolved.keys }
    });

    const role = await tx.role.findFirstOrThrow({
      where: { id: roleId },
      include: ROLE_INCLUDE
    });

    return mapRole(role);
  });
}
