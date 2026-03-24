import { describe, it, expect, vi, beforeEach } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockCustomReport = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn()
};

const mockPrisma = { customReport: mockCustomReport };

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));

// Mock report service functions called by runCustomReport
vi.mock("./reports.service.js", () => ({
  caseStatusDistribution: vi.fn().mockResolvedValue([{ status: "ACTIVE", count: 5 }]),
  hearingOutcomes: vi.fn().mockResolvedValue([]),
  lawyerWorkload: vi.fn().mockResolvedValue([]),
  revenueReport: vi.fn().mockResolvedValue([]),
  outstandingBalances: vi.fn().mockResolvedValue([])
}));

const {
  listCustomReports,
  createCustomReport,
  updateCustomReport,
  deleteCustomReport,
  runCustomReport,
  SUPPORTED_REPORT_TYPES
} = await import("./custom-reports.service.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const actor = makeSessionUser({
  email: "admin@elms.test",
  fullName: "Admin",
  permissions: ["reports:read"]
});

const now = new Date("2026-03-21T00:00:00.000Z");

function makeReportRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "report-1",
    firmId: "firm-1",
    name: "Active Cases",
    description: null,
    reportType: "case-status",
    config: { dateFrom: "2026-01-01", dateTo: "2026-12-31" },
    createdById: "user-1",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

// ── SUPPORTED_REPORT_TYPES ────────────────────────────────────────────────────

describe("SUPPORTED_REPORT_TYPES", () => {
  it("contains the expected report types", () => {
    expect(SUPPORTED_REPORT_TYPES).toContain("case-status");
    expect(SUPPORTED_REPORT_TYPES).toContain("hearing-outcomes");
    expect(SUPPORTED_REPORT_TYPES).toContain("revenue");
    expect(SUPPORTED_REPORT_TYPES).toContain("outstanding-balances");
  });
});

// ── listCustomReports ──────────────────────────────────────────────────────────

describe("listCustomReports", () => {
  it("returns reports scoped to actor's firm", async () => {
    mockCustomReport.findMany.mockResolvedValue([makeReportRecord()]);

    const result = await listCustomReports(actor);

    expect(mockCustomReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ firmId: "firm-1" }) })
    );
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("report-1");
  });
});

// ── createCustomReport ─────────────────────────────────────────────────────────

describe("createCustomReport", () => {
  it("creates report with valid type", async () => {
    mockCustomReport.create.mockResolvedValue(makeReportRecord());

    const result = await createCustomReport(actor, {
      name: "Active Cases",
      reportType: "case-status",
      config: { dateFrom: "2026-01-01" }
    });

    expect(mockCustomReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firmId: "firm-1", reportType: "case-status" })
      })
    );
    expect(result.reportType).toBe("case-status");
  });

  it("rejects unsupported report types", async () => {
    await expect(
      createCustomReport(actor, { name: "Bad Report", reportType: "sql-injection; DROP TABLE", config: {} })
    ).rejects.toThrow("Unsupported report type: sql-injection; DROP TABLE");

    expect(mockCustomReport.create).not.toHaveBeenCalled();
  });

  it("stores validated config with valid date and groupBy", async () => {
    const config = { dateFrom: "2026-01-01", dateTo: "2026-06-30", groupBy: "month" };
    mockCustomReport.create.mockResolvedValue(makeReportRecord({ config }));

    await createCustomReport(actor, { name: "Report", reportType: "revenue", config });

    expect(mockCustomReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ config: expect.objectContaining({ dateFrom: "2026-01-01" }) })
      })
    );
  });

  it("rejects config with invalid dateFrom", async () => {
    await expect(
      createCustomReport(actor, { name: "Report", reportType: "revenue", config: { dateFrom: "not-a-date" } })
    ).rejects.toThrow("dateFrom must be a valid ISO 8601 date string");

    expect(mockCustomReport.create).not.toHaveBeenCalled();
  });

  it("rejects config with invalid dateTo", async () => {
    await expect(
      createCustomReport(actor, { name: "Report", reportType: "revenue", config: { dateTo: "'; DROP TABLE Case; --" } })
    ).rejects.toThrow("dateTo must be a valid ISO 8601 date string");

    expect(mockCustomReport.create).not.toHaveBeenCalled();
  });

  it("rejects config with disallowed groupBy value", async () => {
    await expect(
      createCustomReport(actor, { name: "Report", reportType: "revenue", config: { groupBy: "1; DROP TABLE Case; --" } })
    ).rejects.toThrow("groupBy must be one of:");

    expect(mockCustomReport.create).not.toHaveBeenCalled();
  });
});

// ── updateCustomReport ─────────────────────────────────────────────────────────

describe("updateCustomReport", () => {
  it("returns null when report not found or belongs to another firm", async () => {
    mockCustomReport.findFirst.mockResolvedValue(null);

    const result = await updateCustomReport(actor, "nonexistent-id", { name: "Updated" });

    expect(result).toBeNull();
    expect(mockCustomReport.update).not.toHaveBeenCalled();
  });

  it("rejects update to unsupported report type", async () => {
    mockCustomReport.findFirst.mockResolvedValue(makeReportRecord());

    await expect(
      updateCustomReport(actor, "report-1", { reportType: "unknown-type" })
    ).rejects.toThrow("Unsupported report type: unknown-type");
  });

  it("queries by id and firmId to enforce tenant isolation", async () => {
    mockCustomReport.findFirst.mockResolvedValue(null);

    await updateCustomReport(actor, "report-1", { name: "New Name" });

    expect(mockCustomReport.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "report-1", firmId: "firm-1" })
      })
    );
  });
});

// ── deleteCustomReport ─────────────────────────────────────────────────────────

describe("deleteCustomReport", () => {
  it("returns false when report not found", async () => {
    mockCustomReport.findFirst.mockResolvedValue(null);

    const result = await deleteCustomReport(actor, "nonexistent");

    expect(result).toBe(false);
    expect(mockCustomReport.delete).not.toHaveBeenCalled();
  });

  it("returns true and deletes when report exists", async () => {
    mockCustomReport.findFirst.mockResolvedValue(makeReportRecord());
    mockCustomReport.delete = vi.fn().mockResolvedValue({});

    const result = await deleteCustomReport(actor, "report-1");

    expect(result).toBe(true);
    expect(mockCustomReport.delete).toHaveBeenCalledWith({ where: { id: "report-1" } });
  });
});

// ── runCustomReport ────────────────────────────────────────────────────────────

describe("runCustomReport", () => {
  it("returns null when report not found", async () => {
    mockCustomReport.findFirst.mockResolvedValue(null);

    const result = await runCustomReport(actor, "nonexistent");

    expect(result).toBeNull();
  });

  it("executes the correct report function based on reportType", async () => {
    mockCustomReport.findFirst.mockResolvedValue(makeReportRecord({ reportType: "case-status" }));

    const { caseStatusDistribution } = await import("./reports.service.js");

    const result = await runCustomReport(actor, "report-1");

    expect(result).not.toBeNull();
    expect(result!.reportType).toBe("case-status");
    expect(caseStatusDistribution).toHaveBeenCalled();
  });

  it("returns structured result with ranAt timestamp", async () => {
    mockCustomReport.findFirst.mockResolvedValue(makeReportRecord({ reportType: "lawyer-workload" }));

    const result = await runCustomReport(actor, "report-1");

    expect(result).toMatchObject({
      reportType: "lawyer-workload",
      rows: expect.any(Array),
      ranAt: expect.any(String)
    });
  });
});
