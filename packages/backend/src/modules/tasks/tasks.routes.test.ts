import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const parsePaginationQuery = vi.fn();
const getAuditContext = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const listTasks = vi.fn();
const createTask = vi.fn();
const changeTaskStatus = vi.fn();
const deleteTask = vi.fn();

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

vi.mock("./tasks.service.js", () => ({
  changeTaskStatus,
  createTask,
  deleteTask,
  getTask: vi.fn(),
  listTasks,
  updateTask: vi.fn()
}));

const { registerTaskRoutes } = await import("./tasks.routes.js");

function createApp() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    patch: vi.fn()
  };
}

function findRouteHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown, reply?: unknown) => Promise<unknown>) | undefined;
}

describe("registerTaskRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePaginationQuery.mockReturnValue({ page: 2, limit: 10 });
    getAuditContext.mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "vitest" });
  });

  it("registers task list route and forwards parsed filters", async () => {
    const app = createApp();
    const actor = makeSessionUser({ permissions: ["tasks:read"] });

    listTasks.mockResolvedValueOnce({ items: [], total: 0, page: 2, pageSize: 10 });

    await registerTaskRoutes(app as never);

    const listCall = app.get.mock.calls.find((entry) => entry[0] === "/api/tasks") as
      | [string, { preHandler: unknown[] }, (request: unknown) => Promise<unknown>]
      | undefined;

    expect(listCall).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith("tasks:read");
    expect(listCall?.[1].preHandler).toEqual(["auth-guard", "perm:tasks:read"]);

    const result = await listCall![2]({
      query: {
        q: "deadline",
        status: "PENDING",
        page: "2",
        limit: "10"
      },
      sessionUser: actor
    });

    expect(parsePaginationQuery).toHaveBeenCalled();
    expect(listTasks).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ q: "deadline", status: "PENDING" }),
      { page: 2, limit: 10 }
    );
    expect(result).toEqual({ items: [], total: 0, page: 2, pageSize: 10 });
  });

  it("rejects invalid status payload before changeTaskStatus service call", async () => {
    const app = createApp();
    await registerTaskRoutes(app as never);

    const handler = findRouteHandler(app.patch.mock.calls, "/api/tasks/:id/status");
    expect(handler).toBeDefined();

    await expect(
      handler!({
        params: { id: "task-1" },
        body: { status: "INVALID_STATUS" },
        sessionUser: makeSessionUser({ permissions: ["tasks:update"] })
      })
    ).rejects.toThrow();

    expect(changeTaskStatus).not.toHaveBeenCalled();
  });

  it("deletes task with audit context", async () => {
    const app = createApp();
    await registerTaskRoutes(app as never);

    deleteTask.mockResolvedValueOnce({ success: true });

    const handler = findRouteHandler(app.delete.mock.calls, "/api/tasks/:id");
    expect(handler).toBeDefined();

    const actor = makeSessionUser({ permissions: ["tasks:delete"] });
    const result = await handler!({
      params: { id: "task-1" },
      sessionUser: actor
    });

    expect(deleteTask).toHaveBeenCalledWith(
      actor,
      "task-1",
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
    expect(result).toEqual({ success: true });
  });

  it("creates task and forwards audit metadata", async () => {
    const app = createApp();
    await registerTaskRoutes(app as never);

    createTask.mockResolvedValueOnce({ id: "task-2" });

    const handler = findRouteHandler(app.post.mock.calls, "/api/tasks");
    expect(handler).toBeDefined();

    const actor = makeSessionUser({ permissions: ["tasks:create"] });
    const result = await handler!({
      body: {
        title: "Prepare hearing file",
        caseId: "7d8f8530-b7f9-4e6f-b12e-d6fb141b9ed2",
        dueAt: "2026-04-22T10:00:00.000Z"
      },
      sessionUser: actor
    });

    expect(createTask).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ title: "Prepare hearing file" }),
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
    expect(result).toEqual({ id: "task-2" });
  });
});
