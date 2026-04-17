import type {
  CreateRoleDto,
  RoleDto,
  RoleListResponseDto,
  SessionUser,
  SetRolePermissionsDto,
  UpdateRoleDto
} from "@elms/shared";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { appError } from "../../errors/appError.js";
import type { RepositoryTx } from "../../repositories/types.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  countUsersByRoleId,
  createFirmRole,
  createRolePermissions,
  deleteRoleById,
  findFirmRoleByKey,
  findPermissionsByKeys,
  findRoleWithPermissionsByIdOrThrow,
  getAccessibleRoleByIdOrThrow,
  getFirmRoleByIdOrThrow,
  listAccessibleRoles,
  replaceRolePermissions,
  type RoleWithPermissions,
  updateRoleNameById
} from "../../repositories/roles/roles.repository.js";

function mapRole(role: RoleWithPermissions): RoleDto {
  return {
    id: role.id,
    firmId: role.firmId,
    key: role.key,
    name: role.name,
    scope: role.scope,
    permissions: role.permissions.map((item) => item.permission.key)
  };
}

async function resolvePermissionIds(
  tx: RepositoryTx,
  permissionKeys: string[]
) {
  const uniqueKeys = [...new Set(permissionKeys)];
  if (uniqueKeys.length === 0) {
    return { ids: [], keys: [] };
  }

  const permissions = await findPermissionsByKeys(tx, uniqueKeys);

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const { total, items } = await listAccessibleRoles(tx, actor.firmId, { page, limit });
    return { items: items.map(mapRole), total, page, pageSize: limit };
  });
}

export async function getRole(actor: SessionUser, roleId: string): Promise<RoleDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const role = await getAccessibleRoleByIdOrThrow(tx, actor.firmId, roleId);
    return mapRole(role);
  });
}

export async function createRole(
  actor: SessionUser,
  payload: CreateRoleDto,
  audit: AuditContext
): Promise<RoleDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await findFirmRoleByKey(tx, actor.firmId, payload.key);
    if (existing) {
      throw appError(`A role with key "${payload.key}" already exists for this firm`, 409);
    }

    const role = await createFirmRole(tx, actor.firmId, payload);

    if (payload.permissionKeys) {
      const resolved = await resolvePermissionIds(tx, payload.permissionKeys);
      await createRolePermissions(tx, role.id, resolved.ids);
    }

    const roleWithPermissions = await findRoleWithPermissionsByIdOrThrow(tx, role.id);

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmRoleByIdOrThrow(tx, actor.firmId, roleId);

    if (existing.scope === "SYSTEM") {
      throw appError("System roles cannot be modified", 403);
    }

    await updateRoleNameById(tx, roleId, payload.name);

    if (payload.permissionKeys) {
      const resolved = await resolvePermissionIds(tx, payload.permissionKeys);
      await replaceRolePermissions(tx, roleId, resolved.ids);
    }

    const roleWithPermissions = await findRoleWithPermissionsByIdOrThrow(tx, roleId);

    await writeAuditLog(tx, audit, {
      action: "roles.update",
      entityType: "Role",
      entityId: roleId,
      oldData: { name: existing.name },
      newData: {
        name: payload.name,
        permissionKeys:
          payload.permissionKeys ?? roleWithPermissions.permissions.map((item) => item.permission.key)
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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmRoleByIdOrThrow(tx, actor.firmId, roleId);

    if (existing.scope === "SYSTEM") {
      throw appError("System roles cannot be deleted", 403);
    }

    const userCount = await countUsersByRoleId(tx, roleId);
    if (userCount > 0) {
      throw appError(`Cannot delete a role with ${userCount} assigned user(s). Reassign users first.`, 422);
    }

    await deleteRoleById(tx, roleId);

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmRoleByIdOrThrow(tx, actor.firmId, roleId);

    if (existing.scope === "SYSTEM") {
      throw appError("System role permissions cannot be modified via this endpoint", 403);
    }

    const resolved = await resolvePermissionIds(tx, payload.permissionKeys);

    await replaceRolePermissions(tx, roleId, resolved.ids);

    await writeAuditLog(tx, audit, {
      action: "roles.permissions.set",
      entityType: "Role",
      entityId: roleId,
      newData: { permissionKeys: resolved.keys }
    });

    const role = await findRoleWithPermissionsByIdOrThrow(tx, roleId);

    return mapRole(role);
  });
}
