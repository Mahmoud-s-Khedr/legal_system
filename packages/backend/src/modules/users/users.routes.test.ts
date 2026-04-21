import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthMode } from "@elms/shared";
import { makeSessionUser } from "../../test-utils/session-user.js";

const parsePaginationQuery = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);
const listUsers = vi.fn();

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
  getAuditContext: vi.fn(() => ({ ipAddress: "127.0.0.1", userAgent: "vitest" }))
}));

vi.mock("./users.service.js", () => ({
  adminSetPassword: vi.fn(),
  changeOwnPassword: vi.fn(),
  createLocalUser: vi.fn(),
  getUser: vi.fn(),
  listUsers,
  removeUser: vi.fn(),
  updateUser: vi.fn(),
  updateUserStatus: vi.fn()
}));

const { registerUserRoutes } = await import("./users.routes.js");

describe("registerUserRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePaginationQuery.mockReturnValue({ page: 1, limit: 20 });
  });

  it("GET /api/users forwards one-character query", async () => {
    const app = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      patch: vi.fn(),
      delete: vi.fn()
    };

    const actor = makeSessionUser({ permissions: ["users:read"] });
    listUsers.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });

    await registerUserRoutes(
      app as never,
      { AUTH_MODE: AuthMode.LOCAL } as never
    );

    const listCall = app.get.mock.calls.find((call) => call[0] === "/api/users");
    expect(listCall).toBeDefined();
    const handler = listCall?.[2] as ((request: unknown) => Promise<unknown>) | undefined;
    expect(handler).toBeDefined();

    await handler!({
      query: { q: "ا", page: "1", limit: "20" },
      sessionUser: actor
    });

    expect(listUsers).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ q: "ا" })
    );
  });
});
