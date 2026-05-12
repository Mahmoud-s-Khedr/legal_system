import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_PERMISSIONS, SYSTEM_ROLE_KEYS } from "../config/constants.js";
import { ensureSystemSecurityModel } from "./bootstrap.js";

const systemRoleKeys = Object.values(SYSTEM_ROLE_KEYS);

function createPrismaMock() {
  const roles = new Map<string, { id: string; key: string }>(
    systemRoleKeys.map((key) => [key, { id: `role-${key}`, key }])
  );

  return {
    permission: {
      upsert: vi.fn(),
      findUniqueOrThrow: vi.fn(({ where }: { where: { key: string } }) => ({
        id: `perm-${where.key}`,
        key: where.key
      }))
    },
    role: {
      findFirst: vi.fn(({ where }: { where: { key: string } }) => roles.get(where.key) ?? null),
      create: vi.fn()
    },
    rolePermission: {
      upsert: vi.fn()
    }
  };
}

describe("ensureSystemSecurityModel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates granular authorization permissions", async () => {
    const prisma = createPrismaMock();

    await ensureSystemSecurityModel(prisma as never);

    expect(DEFAULT_PERMISSIONS).toContain("client_portal:manage");
    expect(DEFAULT_PERMISSIONS).toContain("integrations:google_calendar:manage");
    expect(prisma.permission.upsert).toHaveBeenCalledWith({
      where: { key: "client_portal:manage" },
      update: {},
      create: { key: "client_portal:manage" }
    });
    expect(prisma.permission.upsert).toHaveBeenCalledWith({
      where: { key: "integrations:google_calendar:manage" },
      update: {},
      create: { key: "integrations:google_calendar:manage" }
    });
  });

  it("grants new granular permissions only to firm admin by default", async () => {
    const prisma = createPrismaMock();

    await ensureSystemSecurityModel(prisma as never);

    const grants = prisma.rolePermission.upsert.mock.calls.map((call) => call[0]);
    const newPermissionGrants = grants.filter((grant) =>
      [
        "perm-client_portal:manage",
        "perm-integrations:google_calendar:manage"
      ].includes(grant.where.roleId_permissionId.permissionId)
    );

    expect(newPermissionGrants).toHaveLength(2);
    expect(newPermissionGrants).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          where: {
            roleId_permissionId: {
              roleId: `role-${SYSTEM_ROLE_KEYS.FIRM_ADMIN}`,
              permissionId: "perm-client_portal:manage"
            }
          }
        }),
        expect.objectContaining({
          where: {
            roleId_permissionId: {
              roleId: `role-${SYSTEM_ROLE_KEYS.FIRM_ADMIN}`,
              permissionId: "perm-integrations:google_calendar:manage"
            }
          }
        })
      ])
    );
  });
});
