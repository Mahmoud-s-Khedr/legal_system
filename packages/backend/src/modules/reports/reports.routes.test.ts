import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const parsePaginationQuery = vi.fn();
const requirePermission = vi.fn((permission: string) => `perm:${permission}`);

const caseStatusDistribution = vi.fn();
const litigationSheetRows = vi.fn();
const createCustomReport = vi.fn();
const caseProfitability = vi.fn();
const generateReportExcel = vi.fn();
const generateLitigationSheetExcel = vi.fn();
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
  litigationSheetRows,
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
  generateLitigationSheetExcel,
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
    litigationSheetRows.mockResolvedValue([]);
    generateReportExcel.mockResolvedValue(Buffer.from("excel"));
    generateLitigationSheetExcel.mockResolvedValue(Buffer.from("excel-litigation"));
    generateReportPdf.mockResolvedValue(Buffer.from("pdf"));
  });

  it("exports litigation sheet using session preferred language", async () => {
    const app = createApp();
    await registerReportRoutes(app as never);

    litigationSheetRows.mockResolvedValueOnce([
      {
        clientName: "Client A",
        caseNumber: "123",
        caseSubject: "Subject",
        previousSessionDate: "2026-01-01",
        upcomingSessionDate: "2026-02-01",
        decision: "DECIDED",
        notes: "Note"
      }
    ]);

    const handler = findRouteHandler(app.get.mock.calls, "/api/reports/litigation-sheet/export");
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis()
    };

    const actor = makeSessionUser({ permissions: ["reports:read"], preferredLanguage: "fr" });
    const result = await handler!({ sessionUser: actor }, reply);

    expect(litigationSheetRows).toHaveBeenCalledWith(actor);
    expect(generateLitigationSheetExcel).toHaveBeenCalledWith(
      expect.any(Array),
      "fr",
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/)
    );
    expect(reply.header).toHaveBeenCalledWith(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(reply.header).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("elms-litigation-sheet-")
    );
    expect(reply.send).toHaveBeenCalledWith(Buffer.from("excel-litigation"));
    expect(result).toBe(reply);
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

  it("exports report as pdf with expected headers", async () => {
    const app = createApp();
    await registerReportRoutes(app as never);

    caseStatusDistribution.mockResolvedValueOnce([{ status: "ACTIVE", count: 2 }]);
    generateReportPdf.mockResolvedValueOnce(Buffer.from("pdf-content"));

    const handler = findRouteHandler(app.get.mock.calls, "/api/reports/:reportType/export");
    const reply = {
      status: vi.fn().mockReturnThis(),
      send: vi.fn().mockReturnThis(),
      header: vi.fn().mockReturnThis()
    };

    const actor = makeSessionUser({ permissions: ["reports:read"] });
    const result = await handler!(
      {
        params: { reportType: "case-status" },
        query: { format: "pdf", page: "1", limit: "20" },
        sessionUser: actor
      },
      reply
    );

    expect(generateReportPdf).toHaveBeenCalled();
    expect(reply.header).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(reply.header).toHaveBeenCalledWith(
      "Content-Disposition",
      expect.stringContaining("elms-report-case-status-")
    );
    expect(reply.send).toHaveBeenCalledWith(Buffer.from("pdf-content"));
    expect(result).toBe(reply);
  });
});
