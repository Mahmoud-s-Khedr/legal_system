import { describe, expect, it } from "vitest";
import { InvoiceStatus, type InvoiceDto } from "@elms/shared";
import { canRecordPayment, getRemainingInvoiceAmount } from "./InvoicesPage";

describe("InvoicesPage helpers", () => {
  it("allows payment action only for issued and partially paid invoices", () => {
    expect(canRecordPayment(InvoiceStatus.ISSUED)).toBe(true);
    expect(canRecordPayment(InvoiceStatus.PARTIALLY_PAID)).toBe(true);
    expect(canRecordPayment(InvoiceStatus.PAID)).toBe(false);
    expect(canRecordPayment(InvoiceStatus.VOID)).toBe(false);
  });

  it("computes remaining amount and clamps at zero", () => {
    const partialInvoice = {
      totalAmount: "500",
      payments: [{ amount: "150" }, { amount: "100" }]
    } as InvoiceDto;
    const overPaidInvoice = {
      totalAmount: "200",
      payments: [{ amount: "300" }]
    } as InvoiceDto;

    expect(getRemainingInvoiceAmount(partialInvoice)).toBe("250.00");
    expect(getRemainingInvoiceAmount(overPaidInvoice)).toBe("0.00");
  });
});
