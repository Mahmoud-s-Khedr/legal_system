import { describe, expect, it, vi } from "vitest";
import {
  listAccessibleRoles,
  getAccessibleRoleByIdOrThrow,
  findFirmRoleByKey,
  createFirmRole,
  getFirmRoleByIdOrThrow,
  updateRoleNameById,
  findRoleWithPermissionsByIdOrThrow,
  findPermissionsByKeys,
  replaceRolePermissions,
  createRolePermissions,
  countUsersByRoleId,
  deleteRoleById
} from "./roles.repository.js";

function createTx() {
  return {
    role: {
      count: vi.fn(),
      findMany: vi.fn(),
      findFirstOrThrow: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    permission: { findMany: vi.fn() },
    rolePermission: { deleteMany: vi.fn(), createMany: vi.fn() },
    user: { count: vi.fn() }
  };
}

describe("roles.repository", () => {
  it("lists accessible roles with paging", async () => {
    const tx = createTx();
    tx.role.count.mockResolvedValue(2);
    tx.role.findMany.mockResolvedValue([{ id: "r-1" }]);

    const result = await listAccessibleRoles(tx as never, "f-1", { page: 2, limit: 10 });

    expect(result.total).toBe(2);
    expect(result.items).toHaveLength(1);
    expect(tx.role.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { OR: [{ firmId: null }, { firmId: "f-1" }] }, skip: 10, take: 10 })
    );
  });

  it("gets and finds roles", async () => {
    const tx = createTx();
    tx.role.findFirstOrThrow.mockResolvedValue({ id: "r-1" });
    tx.role.findFirst.mockResolvedValue({ id: "r-1" });

    await getAccessibleRoleByIdOrThrow(tx as never, "f-1", "r-1");
    await getFirmRoleByIdOrThrow(tx as never, "f-1", "r-1");
    await findRoleWithPermissionsByIdOrThrow(tx as never, "r-1");
    await findFirmRoleByKey(tx as never, "f-1", "lawyer");

    expect(tx.role.findFirstOrThrow).toHaveBeenCalled();
    expect(tx.role.findFirst).toHaveBeenCalledWith({ where: { firmId: "f-1", key: "lawyer" } });
  });

  it("creates and updates firm roles", async () => {
    const tx = createTx();
    tx.role.create.mockResolvedValue({ id: "r-1" });
    tx.role.update.mockResolvedValue({ id: "r-1" });

    await createFirmRole(tx as never, "f-1", { key: "lawyer", name: "Lawyer" });
    await updateRoleNameById(tx as never, "r-1", "f-1", "Senior Lawyer");

    expect(tx.role.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: { firmId: "f-1", key: "lawyer", name: "Lawyer", scope: "FIRM" } })
    );
    expect(tx.role.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "r-1", firmId: "f-1" }, data: { name: "Senior Lawyer" } })
    );
  });

  it("finds permissions and handles empty key list", async () => {
    const tx = createTx();
    tx.permission.findMany.mockResolvedValue([{ id: "p-1", key: "cases:read" }]);

    expect(await findPermissionsByKeys(tx as never, [])).toEqual([]);
    expect(await findPermissionsByKeys(tx as never, ["cases:read"])).toEqual([{ id: "p-1", key: "cases:read" }]);
  });

  it("replaces and creates role permissions", async () => {
    const tx = createTx();
    tx.rolePermission.deleteMany.mockResolvedValue({ count: 1 });
    tx.rolePermission.createMany.mockResolvedValue({ count: 2 });

    await replaceRolePermissions(tx as never, "r-1", ["p-1", "p-2"]);
    await replaceRolePermissions(tx as never, "r-1", []);

    await createRolePermissions(tx as never, "r-1", ["p-1"]);
    await createRolePermissions(tx as never, "r-1", []);

    expect(tx.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: "r-1" } });
    expect(tx.rolePermission.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: [{ roleId: "r-1", permissionId: "p-1" }, { roleId: "r-1", permissionId: "p-2" }] })
    );
  });

  it("counts users and deletes role", async () => {
    const tx = createTx();
    tx.user.count.mockResolvedValue(3);
    tx.role.delete.mockResolvedValue({ id: "r-1" });

    const count = await countUsersByRoleId(tx as never, "r-1");
    await deleteRoleById(tx as never, "r-1", "f-1");

    expect(count).toBe(3);
    expect(tx.role.delete).toHaveBeenCalledWith({ where: { id: "r-1", firmId: "f-1" } });
  });
});
