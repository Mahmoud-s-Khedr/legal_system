import { describe, expect, it, vi } from "vitest";
import {
  queryCaseStatusDistribution,
  queryHearingOutcomes,
  listActiveFirmUsers,
  countOpenAssignedCases,
  countOpenAssignedTasks,
  countUpcomingAssignedHearings,
  queryRevenueReport,
  listOutstandingFirmInvoices,
  findFirmCaseById,
  listCaseInvoicesWithPayments,
  listCaseExpenses
} from "./reports.repository.js";

function createTx() {
  return {
    $queryRaw: vi.fn(),
    user: { findMany: vi.fn() },
    caseAssignment: { count: vi.fn() },
    task: { count: vi.fn() },
    caseSession: { count: vi.fn() },
    invoice: { findMany: vi.fn() },
    case: { findFirst: vi.fn() },
    expense: { findMany: vi.fn() }
  };
}

describe("reports.repository", () => {
  it("runs raw aggregate queries", async () => {
    const tx = createTx();
    tx.$queryRaw.mockResolvedValueOnce([{ status: "ACTIVE", count: BigInt(2) }]).mockResolvedValueOnce([{ outcome: null, count: BigInt(1) }]).mockResolvedValueOnce([{ month: "2026-04", invoiced: "100", paid: "40" }]);

    await queryCaseStatusDistribution(tx as never, "firm-1", { dateFrom: "2026-01-01", dateTo: "2026-12-31" });
    await queryHearingOutcomes(tx as never, "firm-1", { dateFrom: "2026-01-01", dateTo: "2026-12-31" });
    await queryRevenueReport(tx as never, "firm-1", { dateFrom: "2026-01-01", dateTo: "2026-12-31" });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
  });

  it("queries workload-related counters", async () => {
    const tx = createTx();
    tx.user.findMany.mockResolvedValue([{ id: "u-1", fullName: "Lawyer" }]);
    tx.caseAssignment.count.mockResolvedValue(2);
    tx.task.count.mockResolvedValue(3);
    tx.caseSession.count.mockResolvedValue(1);

    expect(await listActiveFirmUsers(tx as never, "firm-1")).toEqual([{ id: "u-1", fullName: "Lawyer" }]);
    expect(await countOpenAssignedCases(tx as never, "firm-1", "u-1")).toBe(2);
    expect(await countOpenAssignedTasks(tx as never, "firm-1", "u-1")).toBe(3);
    expect(await countUpcomingAssignedHearings(tx as never, "firm-1", "u-1", new Date())).toBe(1);

    expect(tx.task.count).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: { notIn: ["DONE", "CANCELLED"] } }) })
    );
  });

  it("queries invoice/case/expense data helpers", async () => {
    const tx = createTx();
    tx.invoice.findMany.mockResolvedValueOnce([{ id: "i-1" }]).mockResolvedValueOnce([{ id: "i-2", payments: [] }]);
    tx.case.findFirst.mockResolvedValue({ title: "Case A" });
    tx.expense.findMany.mockResolvedValue([{ id: "e-1" }]);

    const outstanding = await listOutstandingFirmInvoices(tx as never, "firm-1", new Date("2026-04-22T00:00:00.000Z"));
    const firmCase = await findFirmCaseById(tx as never, "firm-1", "c-1");
    const invoices = await listCaseInvoicesWithPayments(tx as never, "firm-1", "c-1");
    const expenses = await listCaseExpenses(tx as never, "firm-1", "c-1");

    expect(outstanding).toHaveLength(1);
    expect(firmCase?.title).toBe("Case A");
    expect(invoices).toHaveLength(1);
    expect(expenses).toHaveLength(1);
  });
});
