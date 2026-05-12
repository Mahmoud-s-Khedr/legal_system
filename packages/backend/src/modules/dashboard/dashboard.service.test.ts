import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeSessionUser } from "../../test-utils/session-user.js";

const inTenantTransaction = vi.fn();
const queryRevenueReport = vi.fn();
const queryEarningsLossesReport = vi.fn();
const resolveDashboardChartRules = vi.fn();

vi.mock("../../repositories/unitOfWork.js", () => ({ inTenantTransaction }));
vi.mock("../../repositories/reports/reports.repository.js", () => ({
  queryRevenueReport,
  queryEarningsLossesReport
}));
vi.mock("./dashboard.registry.js", () => ({
  resolveDashboardChartRules
}));

const { getDashboard, getDashboardAnalytics } = await import("./dashboard.service.js");

const actor = makeSessionUser({
  id: "u-1",
  firmId: "f-1",
  roleKey: "firm_admin",
  permissions: ["dashboard:read", "tasks:read", "hearings:read", "invoices:read", "expenses:read"]
});

function createTx() {
  return {
    caseAssignment: { findMany: vi.fn() },
    task: { count: vi.fn(), findMany: vi.fn() },
    caseSession: { count: vi.fn(), findMany: vi.fn(), groupBy: vi.fn() },
    case: { groupBy: vi.fn(), findMany: vi.fn() }
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveDashboardChartRules.mockReturnValue([]);
});

describe("dashboard.service", () => {
  it("returns separate upcoming task and session lists capped to two items", async () => {
    const tx = createTx();
    inTenantTransaction.mockImplementation(async (_firmId, fn) => fn(tx));
    tx.caseAssignment.findMany.mockResolvedValue([]);
    tx.task.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    tx.caseSession.count.mockResolvedValueOnce(4);
    tx.task.findMany.mockResolvedValue([
      {
        id: "t-1",
        title: "Draft motion",
        priority: "HIGH",
        dueAt: new Date("2026-05-14T09:00:00.000Z"),
        case: { id: "c-1", title: "Case A" }
      },
      {
        id: "t-2",
        title: "Prepare evidence",
        priority: "MEDIUM",
        dueAt: new Date("2026-05-15T09:00:00.000Z"),
        case: { id: "c-2", title: "Case B" }
      }
    ]);
    tx.caseSession.findMany.mockResolvedValue([
      {
        id: "h-1",
        sessionDatetime: new Date("2026-05-14T11:00:00.000Z"),
        case: { id: "c-3", title: "Case C" }
      },
      {
        id: "h-2",
        sessionDatetime: new Date("2026-05-16T11:00:00.000Z"),
        case: { id: "c-4", title: "Case D" }
      }
    ]);
    const result = await getDashboard(actor, "my");

    expect(tx.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          dueAt: { gte: expect.any(Date) }
        }),
        take: 2
      })
    );
    expect(tx.caseSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          sessionDatetime: { gte: expect.any(Date) }
        }),
        take: 2
      })
    );
    expect(result.upcomingTasks).toHaveLength(2);
    expect(result.upcomingSessions).toHaveLength(2);
    expect(result.recentActivity).toHaveLength(0);
    expect(result.widgets).toHaveLength(0);
    expect(result.upcomingSessions[0]?.href).toBe("/app/hearings/h-1/edit");
    expect(result.priorityCards.find((card) => card.key === "unassigned")?.href).toContain(
      "assignedToId=unassigned"
    );
  });

  it("ignores removed chart keys and only returns implemented charts", async () => {
    const tx = createTx();
    inTenantTransaction.mockImplementation(async (_firmId, fn) => fn(tx));
    tx.caseAssignment.findMany.mockResolvedValue([]);
    resolveDashboardChartRules.mockReturnValue([{ key: "casesTrend" }, { key: "financeTrend" }]);
    queryRevenueReport.mockResolvedValue([{ month: "2026-05", invoiced: "1200.00", paid: "900.00" }]);
    queryEarningsLossesReport.mockResolvedValue([
      {
        month: "2026-05",
        cashEarnings: "900.00",
        accrualEarnings: "1200.00",
        operatingExpenses: "450.00",
        invoiceLosses: "0.00",
        totalLosses: "450.00",
        netProfitCash: "450.00",
        netProfitAccrual: "750.00"
      }
    ]);

    const result = await getDashboardAnalytics(actor, "office", "30d");

    expect(result.charts).toHaveLength(1);
    expect(result.charts[0]?.key).toBe("financeTrend");
  });

  it("builds finance trend analytics with revenue, profit, and expenses series", async () => {
    const tx = createTx();
    inTenantTransaction.mockImplementation(async (_firmId, fn) => fn(tx));
    tx.caseAssignment.findMany.mockResolvedValue([]);
    resolveDashboardChartRules.mockReturnValue([{ key: "financeTrend" }]);
    queryRevenueReport.mockResolvedValue([
      { month: "2026-04", invoiced: "1000.00", paid: "700.00" },
      { month: "2026-05", invoiced: "1200.00", paid: "900.00" }
    ]);
    queryEarningsLossesReport.mockResolvedValue([
      {
        month: "2026-04",
        cashEarnings: "700.00",
        accrualEarnings: "1000.00",
        operatingExpenses: "300.00",
        invoiceLosses: "0.00",
        totalLosses: "300.00",
        netProfitCash: "400.00",
        netProfitAccrual: "700.00"
      },
      {
        month: "2026-05",
        cashEarnings: "900.00",
        accrualEarnings: "1200.00",
        operatingExpenses: "450.00",
        invoiceLosses: "0.00",
        totalLosses: "450.00",
        netProfitCash: "450.00",
        netProfitAccrual: "750.00"
      }
    ]);

    const result = await getDashboardAnalytics(actor, "office", "30d");

    expect(queryRevenueReport).toHaveBeenCalledWith(
      tx,
      "f-1",
      expect.objectContaining({ dateFrom: expect.any(String), dateTo: expect.any(String) }),
      { caseIds: null }
    );
    expect(result.charts).toHaveLength(1);
    expect(result.charts[0]).toMatchObject({
      key: "financeTrend",
      series: [{ key: "revenue" }, { key: "profit" }, { key: "expenses" }],
      valueFormat: "currency"
    });
    expect(result.charts[0]?.points[0]).toEqual({
      label: "2026-04",
      values: { revenue: 1000, expenses: 300, profit: 700 }
    });
  });
});
