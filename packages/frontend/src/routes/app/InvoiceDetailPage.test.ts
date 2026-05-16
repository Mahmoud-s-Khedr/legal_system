import { describe, expect, it } from "vitest";
import {
  getAppliedCreditAmount,
  getOutstandingAmount,
  getTotalPaidAmount
} from "./InvoiceDetailPage";

describe("InvoiceDetailPage billing helpers", () => {
  it("computes paid, applied credit, and outstanding using credit applications", () => {
    const invoice = {
      totalAmount: "1000.00",
      payments: [{ amount: "300.00" }, { amount: "50.00" }],
      creditApplications: [
        { id: "c-1", amount: "100.00", createdAt: "2026-01-01T00:00:00.000Z" }
      ]
    };

    expect(getTotalPaidAmount(invoice)).toBe(350);
    expect(getAppliedCreditAmount(invoice)).toBe(100);
    expect(getOutstandingAmount(invoice)).toBe(550);
  });

  it("clamps outstanding amount at zero", () => {
    const invoice = {
      totalAmount: "500.00",
      payments: [{ amount: "400.00" }],
      creditApplications: [
        { id: "c-1", amount: "200.00", createdAt: "2026-01-01T00:00:00.000Z" }
      ]
    };

    expect(getOutstandingAmount(invoice)).toBe(0);
  });
});
