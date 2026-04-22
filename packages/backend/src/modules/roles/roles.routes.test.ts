import { beforeEach, describe, expect, it, vi } from "vitest";

const parsePaginationQuery = vi.fn();
const getAuditContext = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const listRoles = vi.fn();
const getRole = vi.fn();
const createRole = vi.fn();
const updateRole = vi.fn();
const deleteRole = vi.fn();
const setRolePermissions = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({
  requireAuth: "auth-guard"
}));

vi.mock("../../middleware/requirePermission.js", () => ({
  requirePermission
}));

vi.mock("../../utils/pagination.js", () => ({
  parsePaginationQuery
}));

vi.mock("../../utils/auditContext.js", () => ({
  getAuditContext
}));

vi.mock("./roles.service.js", () => ({
  createRole,
  deleteRole,
  getRole,
  listRoles,
  setRolePermissions,
  updateRole
}));

const { registerRoleRoutes } = await import("./roles.routes.js");

function createApp() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  };
}

function findHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown) => Promise<unknown>) | undefined;
}

describe("registerRoleRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePaginationQuery.mockReturnValue({ page: 1, limit: 20 });
    getAuditContext.mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "vitest" });
  });

  it("lists roles using parsed pagination", async () => {
    const app = createApp();
    listRoles.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });
    await registerRoleRoutes(app as never);

    const call = app.get.mock.calls.find((entry) => entry[0] === "/api/roles") as
      | [string, { preHandler: unknown[] }, (request: unknown) => Promise<unknown>]
      | undefined;

    expect(call?.[1].preHandler).toEqual(["auth-guard", "perm:roles:read"]);
    await call![2]({ query: { page: "1", limit: "20" }, sessionUser: { id: "u1" } } as never);

    expect(requirePermission).toHaveBeenCalledWith("roles:read");
    expect(listRoles).toHaveBeenCalledWith({ id: "u1" }, { page: 1, limit: 20 });
  });

  it("gets a role by id", async () => {
    const app = createApp();
    getRole.mockResolvedValueOnce({ id: "role-1" });
    await registerRoleRoutes(app as never);

    const handler = findHandler(app.get.mock.calls, "/api/roles/:id");
    const result = await handler!({ params: { id: "role-1" }, sessionUser: { id: "u1" } } as never);
    expect(result).toEqual({ id: "role-1" });
    expect(getRole).toHaveBeenCalledWith({ id: "u1" }, "role-1");
  });

  it("creates a role and validates key format", async () => {
    const app = createApp();
    createRole.mockResolvedValueOnce({ id: "role-2" });
    await registerRoleRoutes(app as never);

    const handler = findHandler(app.post.mock.calls, "/api/roles");

    await expect(
      handler!({ body: { key: "INVALID KEY", name: "Ops" }, sessionUser: { id: "u1" } } as never)
    ).rejects.toThrow();

    const result = await handler!(
      { body: { key: "ops_admin", name: "Ops" }, sessionUser: { id: "u1" } } as never
    );

    expect(createRole).toHaveBeenCalledWith(
      { id: "u1" },
      { key: "ops_admin", name: "Ops" },
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
    expect(result).toEqual({ id: "role-2" });
  });

  it("updates role and permission set", async () => {
    const app = createApp();
    updateRole.mockResolvedValueOnce({ id: "role-1", name: "Updated" });
    setRolePermissions.mockResolvedValueOnce({ id: "role-1", permissions: ["users:read"] });
    await registerRoleRoutes(app as never);

    const updateHandler = findHandler(app.put.mock.calls, "/api/roles/:id");
    const updateResult = await updateHandler!(
      {
        params: { id: "role-1" },
        body: { name: "Updated", permissionKeys: ["users:read"] },
        sessionUser: { id: "u1" }
      } as never
    );

    expect(updateRole).toHaveBeenCalled();
    expect(updateResult).toEqual({ id: "role-1", name: "Updated" });

    const permissionsHandler = findHandler(app.put.mock.calls, "/api/roles/:id/permissions");
    const permissionsResult = await permissionsHandler!(
      {
        params: { id: "role-1" },
        body: { permissionKeys: ["users:read"] },
        sessionUser: { id: "u1" }
      } as never
    );

    expect(setRolePermissions).toHaveBeenCalled();
    expect(permissionsResult).toEqual({ id: "role-1", permissions: ["users:read"] });
  });

  it("deletes role", async () => {
    const app = createApp();
    deleteRole.mockResolvedValueOnce({ success: true });
    await registerRoleRoutes(app as never);

    const handler = findHandler(app.delete.mock.calls, "/api/roles/:id");
    const result = await handler!({ params: { id: "role-1" }, sessionUser: { id: "u1" } } as never);

    expect(deleteRole).toHaveBeenCalledWith(
      { id: "u1" },
      "role-1",
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
    expect(result).toEqual({ success: true });
  });
});
