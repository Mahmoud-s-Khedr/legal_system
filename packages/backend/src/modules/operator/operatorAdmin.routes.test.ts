import { describe, expect, it, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const findUnique = vi.fn();
const findUniqueOrThrow = vi.fn();
const update = vi.fn();
const aggregate = vi.fn();
const count = vi.fn();

vi.mock("../../db/prisma.js", () => ({
  prisma: {
    firm: { findMany, findUnique, findUniqueOrThrow, update, aggregate, count }
  }
}));

const manuallySuspendFirm = vi.fn();
const manuallyReinstateFirm = vi.fn();
const manuallyExtendFirmTrial = vi.fn();

vi.mock("../editions/lifecycle.service.js", () => ({
  manuallySuspendFirm,
  manuallyReinstateFirm,
  manuallyExtendFirmTrial
}));

const requireOperatorAuth = vi.fn();
vi.mock("../../middleware/requireOperatorAuth.js", () => ({ requireOperatorAuth }));

const { operatorAdminRoutes } = await import("./operatorAdmin.routes.js");

function createApp() {
  const routes: Record<string, Record<string, (request: unknown, reply: unknown) => Promise<unknown>>> = {
    GET: {},
    POST: {},
    PATCH: {}
  };
  const hooks: unknown[] = [];
  const app = {
    appEnv: { SAAS_BILLING_MODE: "manual" },
    addHook: vi.fn((_name: string, handler: unknown) => hooks.push(handler)),
    get: vi.fn((path: string, handler: never) => {
      routes.GET[path] = handler;
    }),
    post: vi.fn((path: string, handler: never) => {
      routes.POST[path] = handler;
    }),
    patch: vi.fn((path: string, handler: never) => {
      routes.PATCH[path] = handler;
    })
  };
  return { app, routes, hooks };
}

function createReply() {
  return { status: vi.fn().mockReturnThis(), send: vi.fn((body: unknown) => body) };
}

describe("operatorAdminRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("registers a requireOperatorAuth preValidation hook, not the old system:manage permission", async () => {
    const { app, hooks } = createApp();
    await operatorAdminRoutes(app as never, {} as never);

    expect(hooks).toContain(requireOperatorAuth);
  });

  it("computes mrrTotal from the manual MRR aggregate across active/grace/licensed firms", async () => {
    const { app, routes } = createApp();
    await operatorAdminRoutes(app as never, {} as never);

    count.mockResolvedValueOnce(3).mockResolvedValueOnce(5);
    aggregate.mockResolvedValueOnce({ _sum: { manualMrr: 12345.5 } });

    const reply = createReply();
    await routes.GET["/api/operator/stats"]({} as never, reply as never);

    expect(reply.send).toHaveBeenCalledWith({
      activeFirms: 3,
      totalFirms: 5,
      mrrTotal: 12345.5,
      billingMode: "manual"
    });
  });

  it("suspend route delegates to the lifecycle guard and returns the updated firm", async () => {
    const { app, routes } = createApp();
    await operatorAdminRoutes(app as never, {} as never);

    findUniqueOrThrow.mockResolvedValueOnce({ id: "firm-1", lifecycleStatus: "SUSPENDED" });
    const reply = createReply();
    await routes.POST["/api/operator/firms/:id/suspend"](
      { params: { id: "b7f1e1d0-2a3b-4c5d-8e9f-0a1b2c3d4e5f" } } as never,
      reply as never
    );

    expect(manuallySuspendFirm).toHaveBeenCalledWith("b7f1e1d0-2a3b-4c5d-8e9f-0a1b2c3d4e5f");
    expect(reply.send).toHaveBeenCalledWith({ firm: { id: "firm-1", lifecycleStatus: "SUSPENDED" } });
  });

  it("mrr route updates the manual MRR field on the firm", async () => {
    const { app, routes } = createApp();
    await operatorAdminRoutes(app as never, {} as never);

    update.mockResolvedValueOnce({ id: "firm-1", manualMrr: 500 });
    const reply = createReply();
    await routes.PATCH["/api/operator/firms/:id/mrr"](
      { params: { id: "b7f1e1d0-2a3b-4c5d-8e9f-0a1b2c3d4e5f" }, body: { mrr: 500 } } as never,
      reply as never
    );

    expect(update).toHaveBeenCalledWith({
      where: { id: "b7f1e1d0-2a3b-4c5d-8e9f-0a1b2c3d4e5f" },
      data: { manualMrr: 500 }
    });
    expect(reply.send).toHaveBeenCalledWith({ firm: { id: "firm-1", manualMrr: 500 } });
  });
});
