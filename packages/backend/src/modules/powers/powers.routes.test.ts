import { beforeEach, describe, expect, it, vi } from "vitest";

const parsePaginationQuery = vi.fn();
const getAuditContext = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const listPowers = vi.fn();
const createPower = vi.fn();
const getPower = vi.fn();
const updatePower = vi.fn();
const revokePower = vi.fn();
const deletePower = vi.fn();

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

vi.mock("./powers.service.js", () => ({
  createPower,
  deletePower,
  getPower,
  listPowers,
  revokePower,
  updatePower
}));

const { registerPowersRoutes } = await import("./powers.routes.js");

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

describe("registerPowersRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePaginationQuery.mockReturnValue({ page: 2, limit: 15 });
    getAuditContext.mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "vitest" });
  });

  it("lists powers with filters and pagination", async () => {
    const app = createApp();
    listPowers.mockResolvedValueOnce({ items: [], total: 0 });
    await registerPowersRoutes(app as never);

    const handler = findHandler(app.get.mock.calls, "/api/powers");
    await handler!(
      { query: { clientId: "c1", status: "ACTIVE", page: "2", limit: "15" }, sessionUser: { id: "u1" } } as never
    );

    expect(listPowers).toHaveBeenCalledWith(
      { id: "u1" },
      { clientId: "c1", caseId: undefined, status: "ACTIVE" },
      { page: 2, limit: 15 }
    );
  });

  it("validates create payload and calls service", async () => {
    const app = createApp();
    createPower.mockResolvedValueOnce({ id: "poa-1" });
    await registerPowersRoutes(app as never);

    const handler = findHandler(app.post.mock.calls, "/api/powers");
    await expect(
      handler!({ body: { clientId: "bad" }, sessionUser: { id: "u1" } } as never)
    ).rejects.toThrow();

    const result = await handler!(
      {
        body: {
          clientId: "685ff837-e9f8-40b4-9798-086a06967cf5",
          type: "GENERAL"
        },
        sessionUser: { id: "u1" }
      } as never
    );

    expect(createPower).toHaveBeenCalled();
    expect(result).toEqual({ id: "poa-1" });
  });

  it("supports get, update, revoke, delete flows", async () => {
    const app = createApp();
    getPower.mockResolvedValueOnce({ id: "poa-1" });
    updatePower.mockResolvedValueOnce({ id: "poa-1", number: "42" });
    revokePower.mockResolvedValueOnce({ id: "poa-1", status: "REVOKED" });
    deletePower.mockResolvedValueOnce({ success: true });
    await registerPowersRoutes(app as never);

    const getHandler = findHandler(app.get.mock.calls, "/api/powers/:id");
    expect(await getHandler!({ params: { id: "poa-1" }, sessionUser: { id: "u1" } } as never)).toEqual({ id: "poa-1" });

    const updateHandler = findHandler(app.put.mock.calls, "/api/powers/:id");
    expect(
      await updateHandler!(
        {
          params: { id: "poa-1" },
          body: { number: "42" },
          sessionUser: { id: "u1" }
        } as never
      )
    ).toEqual({ id: "poa-1", number: "42" });

    const revokeHandler = findHandler(app.post.mock.calls, "/api/powers/:id/revoke");
    expect(
      await revokeHandler!(
        {
          params: { id: "poa-1" },
          body: { reason: "expired" },
          sessionUser: { id: "u1" }
        } as never
      )
    ).toEqual({ id: "poa-1", status: "REVOKED" });

    const deleteHandler = findHandler(app.delete.mock.calls, "/api/powers/:id");
    expect(await deleteHandler!({ params: { id: "poa-1" }, sessionUser: { id: "u1" } } as never)).toEqual({ success: true });
  });
});
