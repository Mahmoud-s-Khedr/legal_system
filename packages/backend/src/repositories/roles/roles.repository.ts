import type { Prisma, Role } from "@prisma/client";
import type { RepositoryTx } from "../types.js";

export const ROLE_INCLUDE = {
  permissions: {
    include: { permission: true }
  }
} as const;

export type RoleWithPermissions = Prisma.RoleGetPayload<{ include: typeof ROLE_INCLUDE }>;

export async function listAccessibleRoles(
  tx: RepositoryTx,
  firmId: string,
  pagination: { page: number; limit: number }
): Promise<{ total: number; items: RoleWithPermissions[] }> {
  const { page, limit } = pagination;
  const where = { OR: [{ firmId: null }, { firmId }] };

  const [total, items] = await Promise.all([
    tx.role.count({ where }),
    tx.role.findMany({
      where,
      include: ROLE_INCLUDE,
      orderBy: [{ scope: "asc" }, { name: "asc" }],
      skip: (page - 1) * limit,
      take: limit
    })
  ]);

  return { total, items };
}

export async function getAccessibleRoleByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  roleId: string
): Promise<RoleWithPermissions> {
  return tx.role.findFirstOrThrow({
    where: { id: roleId, OR: [{ firmId: null }, { firmId }] },
    include: ROLE_INCLUDE
  });
}

export async function findFirmRoleByKey(
  tx: RepositoryTx,
  firmId: string,
  key: string
): Promise<Role | null> {
  return tx.role.findFirst({ where: { firmId, key } });
}

export async function createFirmRole(
  tx: RepositoryTx,
  firmId: string,
  payload: { key: string; name: string }
): Promise<RoleWithPermissions> {
  return tx.role.create({
    data: {
      firmId,
      key: payload.key,
      name: payload.name,
      scope: "FIRM"
    },
    include: ROLE_INCLUDE
  });
}

export async function getFirmRoleByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  roleId: string
): Promise<Role> {
  return tx.role.findFirstOrThrow({
    where: { id: roleId, firmId }
  });
}

export async function updateRoleNameById(
  tx: RepositoryTx,
  roleId: string,
  name: string
): Promise<RoleWithPermissions> {
  return tx.role.update({
    where: { id: roleId },
    data: { name },
    include: ROLE_INCLUDE
  });
}

export async function findRoleWithPermissionsByIdOrThrow(
  tx: RepositoryTx,
  roleId: string
): Promise<RoleWithPermissions> {
  return tx.role.findFirstOrThrow({
    where: { id: roleId },
    include: ROLE_INCLUDE
  });
}

export async function findPermissionsByKeys(
  tx: RepositoryTx,
  permissionKeys: string[]
): Promise<Array<{ id: string; key: string }>> {
  if (permissionKeys.length === 0) {
    return [];
  }

  return tx.permission.findMany({
    where: { key: { in: permissionKeys } },
    select: { id: true, key: true }
  });
}

export async function replaceRolePermissions(
  tx: RepositoryTx,
  roleId: string,
  permissionIds: string[]
): Promise<void> {
  await tx.rolePermission.deleteMany({ where: { roleId } });
  if (permissionIds.length > 0) {
    await tx.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId }))
    });
  }
}

export async function createRolePermissions(
  tx: RepositoryTx,
  roleId: string,
  permissionIds: string[]
): Promise<void> {
  if (permissionIds.length === 0) {
    return;
  }

  await tx.rolePermission.createMany({
    data: permissionIds.map((permissionId) => ({ roleId, permissionId }))
  });
}

export async function countUsersByRoleId(tx: RepositoryTx, roleId: string): Promise<number> {
  return tx.user.count({ where: { roleId } });
}

export async function deleteRoleById(tx: RepositoryTx, roleId: string): Promise<void> {
  await tx.role.delete({ where: { id: roleId } });
}
