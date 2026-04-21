import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const parsePaginationQuery = vi.fn();
const getAuditContext = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const listHearings = vi.fn();
const createHearing = vi.fn();
const updateHearingOutcome = vi.fn();
const checkHearingConflict = vi.fn();

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

vi.mock("./hearings.service.js", () => ({
  checkHearingConflict,
  createHearing,
  getHearing: vi.fn(),
  listHearings,
  updateHearing: vi.fn(),
  updateHearingOutcome
}));

vi.mock("../integrations/googleCalendar.service.js", () => ({
  pushHearingToCalendar: vi.fn()
}));

vi.mock("../editions/editionPolicy.js", () => ({
  hasEditionFeature: vi.fn(() => false)
}));

const { registerHearingRoutes } = await import("./hearings.routes.js");

function createApp() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn()
  };
}

function findRouteHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown, reply?: unknown) => Promise<unknown>) | undefined;
}

describe("registerHearingRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePaginationQuery.mockReturnValue({ page: 1, limit: 25 });
    getAuditContext.mockReturnValue({ ipAddress: "127.0.0.1", userAgent: "vitest" });
  });

  it("registers list route with auth/permission and forwards parsed pagination", async () => {
    const app = createApp();
    const actor = makeSessionUser({ permissions: ["hearings:read"] });

    listHearings.mockResolvedValueOnce({ items: [], total: 0, page: 1, pageSize: 25 });

    await registerHearingRoutes(app as never, {} as never);

    const listCall = app.get.mock.calls.find((entry) => entry[0] === "/api/hearings") as
      | [string, { preHandler: unknown[] }, (request: unknown) => Promise<unknown>]
      | undefined;

    expect(listCall).toBeDefined();
    expect(requirePermission).toHaveBeenCalledWith("hearings:read");
    expect(listCall?.[1].preHandler).toEqual(["auth-guard", "perm:hearings:read"]);

    const result = await listCall![2]({
      query: {
        q: "court",
        sortBy: "sessionDatetime",
        sortDir: "asc",
        page: "1",
        limit: "25"
      },
      sessionUser: actor
    });

    expect(parsePaginationQuery).toHaveBeenCalled();
    expect(listHearings).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ q: "court", sortDir: "asc" }),
      { page: 1, limit: 25 }
    );
    expect(result).toEqual({ items: [], total: 0, page: 1, pageSize: 25 });
  });

  it("rejects invalid hearing payloads before service call", async () => {
    const app = createApp();
    await registerHearingRoutes(app as never, {} as never);

    const handler = findRouteHandler(app.post.mock.calls, "/api/hearings");
    expect(handler).toBeDefined();

    await expect(
      handler!({
        body: {
          caseId: "not-a-uuid",
          sessionDatetime: "not-a-date"
        },
        sessionUser: makeSessionUser({ permissions: ["hearings:create"] }),
        log: { warn: vi.fn() }
      })
    ).rejects.toThrow();

    expect(createHearing).not.toHaveBeenCalled();
  });

  it("creates hearing and forwards audit context", async () => {
    const app = createApp();
    await registerHearingRoutes(app as never, {} as never);

    createHearing.mockResolvedValueOnce({ id: "hearing-1" });

    const handler = findRouteHandler(app.post.mock.calls, "/api/hearings");
    expect(handler).toBeDefined();

    const actor = makeSessionUser({ permissions: ["hearings:create"] });
    const result = await handler!({
      body: {
        caseId: "6f6dfa56-173a-4519-b6af-218e7863624a",
        assignedLawyerId: null,
        sessionDatetime: "2026-04-22T10:00:00.000Z",
        nextSessionAt: null,
        outcome: null,
        notes: "Prepare exhibits"
      },
      sessionUser: actor,
      log: { warn: vi.fn() }
    });

    expect(createHearing).toHaveBeenCalledWith(
      actor,
      expect.objectContaining({ caseId: "6f6dfa56-173a-4519-b6af-218e7863624a" }),
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
    expect(result).toEqual({ id: "hearing-1" });
  });

  it("updates hearing outcome with audit context", async () => {
    const app = createApp();
    await registerHearingRoutes(app as never, {} as never);

    updateHearingOutcome.mockResolvedValueOnce({ id: "hearing-2", outcome: "ADJOURNED" });

    const handler = findRouteHandler(app.patch.mock.calls, "/api/hearings/:id/outcome");
    expect(handler).toBeDefined();

    const actor = makeSessionUser({ permissions: ["hearings:update"] });
    const result = await handler!({
      params: { id: "hearing-2" },
      body: { outcome: "ADJOURNED" },
      sessionUser: actor
    });

    expect(updateHearingOutcome).toHaveBeenCalledWith(
      actor,
      "hearing-2",
      { outcome: "ADJOURNED" },
      { ipAddress: "127.0.0.1", userAgent: "vitest" }
    );
    expect(result).toEqual({ id: "hearing-2", outcome: "ADJOURNED" });
  });

  it("checks hearing conflicts endpoint", async () => {
    const app = createApp();
    await registerHearingRoutes(app as never, {} as never);

    checkHearingConflict.mockResolvedValueOnce({
      hasConflict: true,
      conflictingHearingIds: ["hearing-x"]
    });

    const handler = findRouteHandler(app.get.mock.calls, "/api/hearings/conflicts");
    expect(handler).toBeDefined();

    const actor = makeSessionUser({ permissions: ["hearings:read"] });
    const result = await handler!({
      query: {
        assignedLawyerId: "7d8f8530-b7f9-4e6f-b12e-d6fb141b9ed2",
        sessionDatetime: "2026-04-22T10:00:00.000Z"
      },
      sessionUser: actor
    });

    expect(checkHearingConflict).toHaveBeenCalledWith(actor, {
      assignedLawyerId: "7d8f8530-b7f9-4e6f-b12e-d6fb141b9ed2",
      sessionDatetime: "2026-04-22T10:00:00.000Z"
    });
    expect(result).toEqual({ hasConflict: true, conflictingHearingIds: ["hearing-x"] });
  });
});
