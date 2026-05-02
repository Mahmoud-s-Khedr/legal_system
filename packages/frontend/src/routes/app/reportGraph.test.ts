import { describe, expect, it } from "vitest";
import { buildReportGraphData } from "./reportGraph";

describe("buildReportGraphData", () => {
  it("maps revenue rows to line graph spec", () => {
    const spec = buildReportGraphData("revenue", [
      { month: "2026-01", invoiced: "100.00", paid: "80.00" }
    ]);
    expect(spec.chart).toBe("line");
    expect(spec.data[0]).toMatchObject({ label: "2026-01", invoiced: 100, paid: 80 });
  });

  it("buckets outstanding balances for graph", () => {
    const spec = buildReportGraphData("outstanding-balances", [
      { invoiceId: "1", invoiceNumber: "INV-1", clientName: "A", totalAmount: "50", dueDate: null, daysOverdue: 10 },
      { invoiceId: "2", invoiceNumber: "INV-2", clientName: "B", totalAmount: "70", dueDate: null, daysOverdue: 95 }
    ]);
    expect(spec.chart).toBe("bar");
    expect(spec.data.some((d) => d.label === "1-30")).toBe(true);
    expect(spec.data.some((d) => d.label === "90+")).toBe(true);
  });
});
