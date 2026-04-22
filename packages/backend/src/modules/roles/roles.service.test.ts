import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const inTenantTransaction = vi.fn();
const writeAuditLog = vi.fn();

const countUsersByRoleId = vi.fn();
const createFirmRole = vi.fn();
const createRolePermissions = vi.fn();
const deleteRoleById = vi.fn();
const findFirmRoleByKey = vi.fn();
const findPermissionsByKeys = vi.fn();
const findRoleWithPermissionsByIdOrThrow = vi.fn();
const getAccessibleRoleByIdOrThrow = vi.fn();
const getFirmRoleByIdOrThrow = vi.fn();
const listAccessibleRoles = vi.fn();
const replaceRolePermissions = vi.fn();
const updateRoleNameById = vi.fn();

vi.mock("../../repositories/unitOfWork.js", () => ({ inTenantTransaction }));
vi.mock("../../services/audit.service.js", () => ({ writeAuditLog }));
vi.mock("../../repositories/roles/roles.repository.js", () => ({
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
  updateRoleNameById
}));

const { listRoles, getRole, createRole, updateRole, deleteRole, setRolePermissions } = await import("./roles.service.js");

const actor = makeSessionUser({ id: "u-1", firmId: "f-1" });
const audit = { ipAddress: "127.0.0.1", userAgent: "vitest" };

const roleWithPermissions = {
  id: "r-1",
  firmId: "f-1",
  key: "lawyer",
  name: "Lawyer",
  scope: "FIRM",
  permissions: [{ permission: { key: "cases:read" } }]
};

beforeEach(() => {
  vi.clearAllMocks();
  inTenantTransaction.mockImplementation(async (_firmId, fn) => fn({ tx: true }));
  findPermissionsByKeys.mockResolvedValue([{ id: "p-1", key: "cases:read" }]);
  findRoleWithPermissionsByIdOrThrow.mockResolvedValue(roleWithPermissions);
});

describe("roles.service", () => {
  it("lists and gets accessible roles", async () => {
    listAccessibleRoles.mockResolvedValue({ total: 1, items: [roleWithPermissions] });
    getAccessibleRoleByIdOrThrow.mockResolvedValue(roleWithPermissions);

    const listed = await listRoles(actor, { page: 1, limit: 20 });
    const single = await getRole(actor, "r-1");

    expect(listed.total).toBe(1);
    expect(single.permissions).toEqual(["cases:read"]);
  });

  it("creates role and prevents duplicate keys", async () => {
    findFirmRoleByKey.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: "r-existing" });
    createFirmRole.mockResolvedValue({ id: "r-1" });

    const created = await createRole(
      actor,
      { key: "lawyer", name: "Lawyer", permissionKeys: ["cases:read"] },
      audit as never
    );

    expect(createRolePermissions).toHaveBeenCalledWith({ tx: true }, "r-1", ["p-1"]);
    expect(created.id).toBe("r-1");

    await expect(
      createRole(actor, { key: "lawyer", name: "Lawyer" }, audit as never)
    ).rejects.toMatchObject({ statusCode: 409 });
  });

  it("updates role and rejects system role updates", async () => {
    getFirmRoleByIdOrThrow.mockResolvedValueOnce({ id: "r-1", name: "Old", scope: "FIRM" }).mockResolvedValueOnce({ scope: "SYSTEM" });

    const updated = await updateRole(
      actor,
      "r-1",
      { name: "New", permissionKeys: ["cases:read"] },
      audit as never
    );

    expect(updateRoleNameById).toHaveBeenCalledWith({ tx: true }, "r-1", "f-1", "New");
    expect(replaceRolePermissions).toHaveBeenCalledWith({ tx: true }, "r-1", ["p-1"]);
    expect(updated.name).toBe("Lawyer");

    await expect(updateRole(actor, "r-system", { name: "x" }, audit as never)).rejects.toMatchObject({ statusCode: 403 });
  });

  it("deletes role only when non-system and no assigned users", async () => {
    getFirmRoleByIdOrThrow.mockResolvedValue({ id: "r-1", key: "lawyer", name: "Lawyer", scope: "FIRM" });
    countUsersByRoleId.mockResolvedValueOnce(0).mockResolvedValueOnce(2);

    const result = await deleteRole(actor, "r-1", audit as never);
    expect(deleteRoleById).toHaveBeenCalledWith({ tx: true }, "r-1", "f-1");
    expect(result).toEqual({ success: true });

    await expect(deleteRole(actor, "r-1", audit as never)).rejects.toMatchObject({ statusCode: 422 });
  });

  it("sets role permissions and rejects unknown/system role", async () => {
    getFirmRoleByIdOrThrow.mockResolvedValueOnce({ id: "r-1", scope: "FIRM" }).mockResolvedValueOnce({ id: "r-1", scope: "SYSTEM" });

    const result = await setRolePermissions(
      actor,
      "r-1",
      { permissionKeys: ["cases:read"] },
      audit as never
    );

    expect(replaceRolePermissions).toHaveBeenCalledWith({ tx: true }, "r-1", ["p-1"]);
    expect(result.id).toBe("r-1");

    await expect(
      setRolePermissions(actor, "r-1", { permissionKeys: ["cases:read"] }, audit as never)
    ).rejects.toMatchObject({ statusCode: 403 });

    getFirmRoleByIdOrThrow.mockResolvedValue({ id: "r-1", scope: "FIRM" });
    findPermissionsByKeys.mockResolvedValue([]);
    await expect(
      setRolePermissions(actor, "r-1", { permissionKeys: ["missing"] }, audit as never)
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});
