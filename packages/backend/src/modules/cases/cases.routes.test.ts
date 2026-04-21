import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const parsePaginationQuery = vi.fn();
const getAuditContext = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const listCases = vi.fn();
const addCaseParty = vi.fn();
const reorderCaseCourts = vi.fn();

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

vi.mock("./cases.service.js", () => ({
  addCaseAssignment: vi.fn(),
  addCaseCourt: vi.fn(),
  addCaseParty,
  changeCaseStatus: vi.fn(),
  createCase: vi.fn(),
  deleteCase: vi.fn(),
  getCase: vi.fn(),
  listCaseAssignments: vi.fn(),
  listCaseParties: vi.fn(),
  listCaseCourts: vi.fn(),
  listCaseStatusHistory: vi.fn(),
  listCases,
  removeCaseCourt: vi.fn(),
  removeCaseParty: vi.fn(),
  updateCaseParty: vi.fn(),
  reorderCaseCourts,
  unassignCase: vi.fn(),
  updateCase: vi.fn(),
  updateCaseCourt: vi.fn()
}));

const { registerCaseRoutes } = await import("./cases.routes.js");

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

describe("registerCaseRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePaginationQuery.mockReturnValue({ page: 3, limit: 7 });
    getAuditContext.mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "vitest" });
  });

  it("registers list route with auth/permission and forwards parsed pagination", async () => {
    const app = createApp();
    const actor = makeSessionUser({ permissions: ["cases:read"] });

    listCases.mockResolvedValueOnce({ items: [], total: 0, page: 3, pageSize: 7 });

    await registerCaseRoutes(app as never);

    const listCall = app.get.mock.calls.find((entry) => entry[0] === "/api/cases") as
      | [string, { preHandler: unknown[] }, (request: unknown) => Promise<unknown>]
      | undefined;

    expect(listCall).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith("cases:read");
    expect(listCall?.[1].preHandler).toEqual(["auth-guard", "perm:cases:read"]);

    const result = await listCall![2]({
      query: {
        q: "lease",
        status: "OPEN",
        sortBy: "createdAt",
        sortDir: "desc",
        page: "3",
        limit: "7"
      },
      sessionUser: actor
    });

    expect(parsePaginationQuery).toHaveBeenCalled();
    expect(listCases).toHaveBeenCalledWith(actor, {
      q: "lease",
      status: "OPEN",
      type: undefined,
      assignedLawyerId: undefined,
      createdFrom: undefined,
      createdTo: undefined,
      sortBy: "createdAt",
      sortDir: "desc",
      page: 3,
      limit: 7
    });
    expect(result).toEqual({ items: [], total: 0, page: 3, pageSize: 7 });
  });

  it("forwards one-character query for case search", async () => {
    const app = createApp();
    const actor = makeSessionUser({ permissions: ["cases:read"] });
    listCases.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 20 });
    parsePaginationQuery.mockReturnValueOnce({ page: 1, limit: 20 });

    await registerCaseRoutes(app as never);

    const listCall = app.get.mock.calls.find((entry) => entry[0] === "/api/cases") as
      | [string, { preHandler: unknown[] }, (request: unknown) => Promise<unknown>]
      | undefined;

    await listCall![2]({
      query: { q: "ا", page: "1", limit: "20" },
      sessionUser: actor
    });

    expect(listCases).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ q: "ا" })
    );
  });

  it("rejects invalid party payloads before calling service", async () => {
    const app = createApp();
    await registerCaseRoutes(app as never);

    const handler = findRouteHandler(app.post.mock.calls, "/api/cases/:id/parties");
    expect(handler).toBeDefined();

    await expect(
      handler!({
        params: { id: "case-1" },
        body: { name: "Opponent", role: "defendant", partyType: "INVALID" },
        sessionUser: makeSessionUser({ permissions: ["cases:update"] })
      })
    ).rejects.toThrow();

    expect(addCaseParty).not.toHaveBeenCalled();
  });

  it("reorders case courts with audit context", async () => {
    const app = createApp();
    await registerCaseRoutes(app as never);

    reorderCaseCourts.mockResolvedValueOnce([{ id: "court-1" }]);

    const handler = findRouteHandler(app.patch.mock.calls, "/api/cases/:id/courts/reorder");
    expect(handler).toBeDefined();

    const actor = makeSessionUser({ permissions: ["cases:update"] });
    const result = await handler!({
      params: { id: "ab3bb1a8-b6a0-43a8-90aa-eeb5f126f303" },
      body: { orderedIds: ["f6f27c2b-fab5-4b36-b445-0221703f0b42"] },
      sessionUser: actor
    });

    expect(reorderCaseCourts).toHaveBeenCalledWith(
      actor,
      "ab3bb1a8-b6a0-43a8-90aa-eeb5f126f303",
      { orderedIds: ["f6f27c2b-fab5-4b36-b445-0221703f0b42"] },
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
    expect(result).toEqual([{ id: "court-1" }]);
  });
});
