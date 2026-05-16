import { describe, expect, it } from "vitest";
import { InvoiceStatus, type InvoiceDto } from "@elms/shared";
import {
  canRecordPayment,
  getInvoiceStatusLabel,
  getRemainingInvoiceAmount
} from "./InvoicesPage";

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
      payments: [{ amount: "150" }, { amount: "100" }],
      creditApplications: []
    } as unknown as InvoiceDto;
    const overPaidInvoice = {
      totalAmount: "200",
      payments: [{ amount: "300" }],
      creditApplications: []
    } as unknown as InvoiceDto;

    expect(getRemainingInvoiceAmount(partialInvoice)).toBe("250.00");
    expect(getRemainingInvoiceAmount(overPaidInvoice)).toBe("0.00");
  });

  it("uses enum localization key for invoice status labels", () => {
    const t = ((key: string) =>
      key === "enums.InvoiceStatus.PAID" ? "Paid Localized" : key) as never;

    expect(getInvoiceStatusLabel(t, InvoiceStatus.PAID)).toBe("Paid Localized");
    expect(getInvoiceStatusLabel(t, InvoiceStatus.VOID)).toBe("VOID");
  });
});
