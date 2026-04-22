import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  case: { findMany: vi.fn(), findFirst: vi.fn() },
  invoice: { findMany: vi.fn() }
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));

const { registerPortalRoutes } = await import("./portal.routes.js");

function createApp() {
  return {
    get: vi.fn(),
    jwt: { verify: vi.fn() }
  };
}

function getHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[1] as ((request: unknown, reply: unknown) => Promise<unknown>) | undefined;
}

describe("portal.routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("requires portal auth and validates audience", async () => {
    const app = createApp();
    await registerPortalRoutes(app as never);

    const listCases = getHandler(app.get.mock.calls, "/api/portal/cases");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };

    await listCases!({ cookies: {} } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(401);

    app.jwt.verify.mockRejectedValueOnce(new Error("bad"));
    await listCases!({ cookies: { elms_portal_token: "x" } } as never, reply as never);
    expect(reply.send).toHaveBeenCalledWith({ message: "Invalid or expired portal token" });

    app.jwt.verify.mockResolvedValueOnce({ aud: "wrong" });
    await listCases!({ cookies: { elms_portal_token: "x" } } as never, reply as never);
    expect(reply.send).toHaveBeenCalledWith({ message: "Invalid token audience" });
  });

  it("lists portal cases with next hearing mapping", async () => {
    const app = createApp();
    await registerPortalRoutes(app as never);

    const listCases = getHandler(app.get.mock.calls, "/api/portal/cases");
    app.jwt.verify.mockResolvedValue({ aud: "elms-portal", clientId: "c-1", firmId: "f-1" });
    mockPrisma.case.findMany.mockResolvedValue([
      {
        id: "case-1",
        title: "Case",
        caseNumber: "100",
        type: "CIVIL",
        status: "ACTIVE",
        createdAt: new Date("2026-01-01T00:00:00.000Z"),
        updatedAt: new Date("2026-01-02T00:00:00.000Z"),
        sessions: [{ sessionDatetime: new Date("2026-05-01T00:00:00.000Z") }]
      }
    ]);

    const result = await listCases!({ cookies: { elms_portal_token: "x" } } as never, { status: vi.fn(), send: vi.fn() } as never);

    expect(mockPrisma.case.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: "c-1", firmId: "f-1", deletedAt: null } })
    );
    expect(result).toEqual([
      expect.objectContaining({ id: "case-1", nextHearing: new Date("2026-05-01T00:00:00.000Z") })
    ]);
  });

  it("handles case details not-found and success response shaping", async () => {
    const app = createApp();
    await registerPortalRoutes(app as never);

    const details = getHandler(app.get.mock.calls, "/api/portal/cases/:caseId");
    const reply = { status: vi.fn().mockReturnThis(), send: vi.fn().mockReturnThis() };
    app.jwt.verify.mockResolvedValue({ aud: "elms-portal", clientId: "c-1", firmId: "f-1" });

    mockPrisma.case.findFirst.mockResolvedValueOnce(null);
    await details!({ cookies: { elms_portal_token: "x" }, params: { caseId: "missing" } } as never, reply as never);
    expect(reply.status).toHaveBeenCalledWith(404);

    mockPrisma.case.findFirst.mockResolvedValueOnce({
      id: "case-1",
      title: "Case",
      caseNumber: "100",
      type: "CIVIL",
      status: "ACTIVE",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      courts: [{ id: "court-1" }],
      sessions: [{ id: "s-1", sessionDatetime: new Date("2026-05-01T00:00:00.000Z"), nextSessionAt: null, outcome: null, notes: "hidden" }],
      assignments: [{ roleOnCase: "LEAD", user: { fullName: "Lawyer", email: "law@x.com" } }]
    });

    const result = await details!(
      { cookies: { elms_portal_token: "x" }, params: { caseId: "case-1" } } as never,
      reply as never
    );

    expect(result).toEqual(
      expect.objectContaining({
        id: "case-1",
        hearings: [expect.objectContaining({ id: "s-1" })],
        lawyers: [expect.objectContaining({ fullName: "Lawyer", role: "LEAD" })]
      })
    );
    expect((result as { hearings: Array<{ notes?: string }> }).hearings[0]?.notes).toBeUndefined();
  });

  it("lists invoices for authenticated portal client", async () => {
    const app = createApp();
    await registerPortalRoutes(app as never);

    const invoices = getHandler(app.get.mock.calls, "/api/portal/invoices");
    app.jwt.verify.mockResolvedValue({ aud: "elms-portal", clientId: "c-1", firmId: "f-1" });
    mockPrisma.invoice.findMany.mockResolvedValue([{ id: "i-1", invoiceNumber: "INV-1" }]);

    const result = await invoices!({ cookies: { elms_portal_token: "x" } } as never, { status: vi.fn(), send: vi.fn() } as never);

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { clientId: "c-1", firmId: "f-1" } })
    );
    expect(result).toEqual([{ id: "i-1", invoiceNumber: "INV-1" }]);
  });
});
