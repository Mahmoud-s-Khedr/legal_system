import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const parsePaginationQuery = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const caseStatusDistribution = vi.fn();
const createCustomReport = vi.fn();
const caseProfitability = vi.fn();
const generateReportExcel = vi.fn();
const generateReportPdf = vi.fn();

vi.mock("../../middleware/requireAuth.js", () => ({
  requireAuth: "auth-guard"
}));

vi.mock("../../middleware/requirePermission.js", () => ({
  requirePermission
}));

vi.mock("../../utils/pagination.js", () => ({
  parsePaginationQuery
}));

vi.mock("./reports.service.js", () => ({
  caseStatusDistribution,
  hearingOutcomes: vi.fn(),
  lawyerWorkload: vi.fn(),
  revenueReport: vi.fn(),
  outstandingBalances: vi.fn(),
  caseProfitability
}));

vi.mock("./custom-reports.service.js", () => ({
  listCustomReports: vi.fn(),
  createCustomReport,
  updateCustomReport: vi.fn(),
  deleteCustomReport: vi.fn(),
  runCustomReport: vi.fn(),
  createCustomReportRunSession: vi.fn(),
  listCustomReportRunRows: vi.fn()
}));

vi.mock("./report.export.js", () => ({
  generateReportExcel,
  generateReportPdf
}));

const { registerReportRoutes } = await import("./reports.routes.js");

function createApp() {
  return {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  };
}

function findRouteHandler(calls: unknown[][], path: string) {
  const call = calls.find((entry) => entry[0] === path);
  return call?.[2] as ((request: unknown, reply?: unknown) => Promise<unknown>) | undefined;
}

describe("registerReportRoutes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    parsePaginationQuery.mockReturnValue({ page: 1, limit: 25 });
    caseStatusDistribution.mockResolvedValue([]);
    generateReportExcel.mockResolvedValue(Buffer.from("excel"));
    generateReportPdf.mockResolvedValue(Buffer.from("pdf"));
  });

  it("returns 400 for unknown report type export", async () => {
    const app = createApp();
    await registerReportRoutes(app as never);

    const handler = findRouteHandler(app.get.mock.calls, "/api/reports/:reportType/export");
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis()
    };

    const actor = makeSessionUser({ permissions: ["reports:read"] });
    const result = await handler!(
      {
        params: { reportType: "unknown" },
        query: { format: "excel" },
        sessionUser: actor
      },
      reply
    );

    expect(reply.status).toHaveBeenCalledWith(400);
    expect(reply.send).toHaveBeenCalledWith({ error: "Unknown report type" });
    expect(result).toBe(reply);
  });

  it("returns 404 when case profitability case is missing", async () => {
    const app = createApp();
    await registerReportRoutes(app as never);

    caseProfitability.mockResolvedValueOnce(null);

    const handler = findRouteHandler(app.get.mock.calls, "/api/reports/case-profitability/:caseId");
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    const actor = makeSessionUser({ permissions: ["reports:read"] });
    const result = await handler!({ params: { caseId: "case-404" }, sessionUser: actor }, reply);

    expect(caseProfitability).toHaveBeenCalledWith(actor, "case-404");
    expect(reply.status).toHaveBeenCalledWith(404);
    expect(reply.send).toHaveBeenCalledWith({ error: "Case not found" });
    expect(result).toBe(reply);
  });

  it("creates custom report and returns 201", async () => {
    const app = createApp();
    await registerReportRoutes(app as never);

    createCustomReport.mockResolvedValueOnce({ id: "custom-1", name: "A" });

    const handler = findRouteHandler(app.post.mock.calls, "/api/reports/custom");
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis()
    };

    const actor = makeSessionUser({ permissions: ["reports:read"] });
    const payload = {
      name: "Firm Revenue",
      reportType: "revenue",
      config: { columns: ["month", "paid"] }
    };

    const result = await handler!({ body: payload, sessionUser: actor }, reply);

    expect(createCustomReport).toHaveBeenCalledWith(actor, payload);
    expect(reply.status).toHaveBeenCalledWith(201);
    expect(reply.send).toHaveBeenCalledWith({ id: "custom-1", name: "A" });
    expect(result).toBe(reply);
  });
});
