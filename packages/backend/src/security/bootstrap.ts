import { DEFAULT_PERMISSIONS, SYSTEM_ROLE_KEYS } from "../config/constants.js";
import type { PrismaClient, RoleScope } from "@prisma/client";

const ROLE_PERMISSION_MAP: Record<string, string[]> = {
  [SYSTEM_ROLE_KEYS.FIRM_ADMIN]: DEFAULT_PERMISSIONS,
  [SYSTEM_ROLE_KEYS.SENIOR_LAWYER]: [
    "firms:read",
    "settings:read",
    "roles:read",
    "clients:create",
    "clients:read",
    "clients:update",
    "cases:create",
    "cases:read",
    "cases:update",
    "cases:assign",
    "cases:status",
    "hearings:create",
    "hearings:read",
    "hearings:update",
    "tasks:create",
    "tasks:read",
    "tasks:update",
    "dashboard:read",
    "documents:create",
    "documents:read",
    "documents:update",
    "documents:delete",
    "reports:read",
    "research:use",
    "lookups:read",
    "invoices:create",
    "invoices:read",
    "invoices:update",
    "expenses:create",
    "expenses:read",
    "expenses:update"
  ],
  [SYSTEM_ROLE_KEYS.JUNIOR_LAWYER]: [
    "firms:read",
    "settings:read",
    "roles:read",
    "clients:read",
    "cases:read",
    "hearings:read",
    "tasks:read",
    "tasks:update",
    "dashboard:read",
    "documents:create",
    "documents:read",
    "research:use",
    "lookups:read",
    "invoices:read",
    "expenses:read"
  ],
  [SYSTEM_ROLE_KEYS.PARALEGAL]: [
    "firms:read",
    "settings:read",
    "clients:read",
    "cases:read",
    "hearings:read",
    "tasks:read",
    "tasks:update",
    "dashboard:read",
    "documents:create",
    "documents:read",
    "research:use",
    "lookups:read"
  ],
  [SYSTEM_ROLE_KEYS.SECRETARY]: [
    "firms:read",
    "settings:read",
    "clients:read",
    "cases:read",
    "hearings:read",
    "tasks:read",
    "dashboard:read",
    "documents:read",
    "lookups:read"
  ]
};

const SYSTEM_ROLES = [
  { key: SYSTEM_ROLE_KEYS.FIRM_ADMIN, name: "Firm Admin" },
  { key: SYSTEM_ROLE_KEYS.SENIOR_LAWYER, name: "Senior Lawyer" },
  { key: SYSTEM_ROLE_KEYS.JUNIOR_LAWYER, name: "Junior Lawyer" },
  { key: SYSTEM_ROLE_KEYS.PARALEGAL, name: "Paralegal" },
  { key: SYSTEM_ROLE_KEYS.SECRETARY, name: "Secretary" }
] as const;

export async function ensureSystemSecurityModel(prisma: PrismaClient) {
  for (const permissionKey of DEFAULT_PERMISSIONS) {
    await prisma.permission.upsert({
      where: { key: permissionKey },
      update: {},
      create: { key: permissionKey }
    });
  }

  for (const role of SYSTEM_ROLES) {
    let existingRole = await prisma.role.findFirst({
      where: {
        firmId: null,
        key: role.key
      }
    });

    if (!existingRole) {
      existingRole = await prisma.role.create({
        data: {
          key: role.key,
          name: role.name,
          scope: "SYSTEM" satisfies RoleScope
        }
      });
    }

    const desiredPermissions = ROLE_PERMISSION_MAP[role.key] ?? [];
    for (const permissionKey of desiredPermissions) {
      const permission = await prisma.permission.findUniqueOrThrow({
        where: { key: permissionKey }
      });

      await prisma.rolePermission.upsert({
        where: {
          roleId_permissionId: {
            roleId: existingRole.id,
            permissionId: permission.id
          }
        },
        update: {},
        create: {
          roleId: existingRole.id,
          permissionId: permission.id
        }
      });
    }
  }
}
