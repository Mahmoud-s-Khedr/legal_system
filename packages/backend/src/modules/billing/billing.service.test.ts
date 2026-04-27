import { describe, it, expect, vi, beforeEach } from "vitest";
import { Decimal } from "@prisma/client/runtime/library";
import { makeSessionUser } from "../../test-utils/session-user.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockInvoice = {
  findMany: vi.fn(),
  findFirst: vi.fn(),
  findFirstOrThrow: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn()
};

const mockInvoiceItem = {
  deleteMany: vi.fn(),
  createMany: vi.fn()
};

const mockPayment = {
  create: vi.fn(),
  findMany: vi.fn()
};

const mockInvoiceCreditApplication = {
  findMany: vi.fn(),
  create: vi.fn()
};

const mockClientCreditBalance = {
  findUnique: vi.fn(),
  upsert: vi.fn(),
  updateMany: vi.fn()
};

const mockClientCreditEntry = {
  create: vi.fn()
};

const mockExpense = {
  findMany: vi.fn(),
  findFirstOrThrow: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  count: vi.fn()
};

const mockAuditLog = { create: vi.fn() };

const mockPrisma = {
  invoice: mockInvoice,
  invoiceItem: mockInvoiceItem,
  payment: mockPayment,
  invoiceCreditApplication: mockInvoiceCreditApplication,
  clientCreditBalance: mockClientCreditBalance,
  clientCreditEntry: mockClientCreditEntry,
  expense: mockExpense,
  auditLog: mockAuditLog
};

vi.mock("../../db/prisma.js", () => ({ prisma: mockPrisma }));
vi.mock("../../db/tenant.js", () => ({
  withTenant: vi.fn((_prisma: unknown, _firmId: string, fn: (tx: typeof mockPrisma) => unknown) =>
    fn(mockPrisma)
  )
}));
vi.mock("../../services/audit.service.js", () => ({
  writeAuditLog: vi.fn()
}));

const {
  listInvoices,
  getInvoice,
  createInvoice,
  issueInvoice,
  voidInvoice,
  deleteInvoice,
  addPayment,
  listExpenses,
  createExpense,
  deleteExpense,
  getCaseBillingSummary
} = await import("./billing.service.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

const actor = makeSessionUser({
  email: "admin@elms.test",
  fullName: "Admin",
  permissions: ["invoices:read", "invoices:create", "invoices:update", "expenses:read", "expenses:create"]
});

const audit = { actor };
const now = new Date("2026-03-21T00:00:00.000Z");

function makeInvoiceRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "inv-1",
    firmId: "firm-1",
    caseId: "case-1",
    clientId: null,
    invoiceNumber: "INV-2026-0001",
    status: "DRAFT",
    feeType: "FIXED",
    subtotalAmount: new Decimal("1000.00"),
    taxAmount: new Decimal("100.00"),
    discountAmount: new Decimal("0.00"),
    totalAmount: new Decimal("1100.00"),
    issuedAt: null,
    dueDate: null,
    createdAt: now,
    updatedAt: now,
    case: { title: "Test Case" },
    client: null,
    items: [
      {
        id: "item-1",
        invoiceId: "inv-1",
        description: "Legal fees",
        quantity: 1,
        unitPrice: new Decimal("1000.00"),
        total: new Decimal("1000.00")
      }
    ],
    payments: [],
    creditApplications: [],
    ...overrides
  };
}

function makeExpenseRecord(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: "exp-1",
    firmId: "firm-1",
    caseId: "case-1",
    category: "COURT_FEES",
    amount: new Decimal("250.00"),
    description: "Filing fee",
    receiptDocumentId: null,
    createdAt: now,
    updatedAt: now,
    case: { title: "Test Case" },
    ...overrides
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoiceCreditApplication.findMany.mockResolvedValue([]);
  mockClientCreditBalance.findUnique.mockResolvedValue(null);
  mockClientCreditBalance.updateMany.mockResolvedValue({ count: 0 });
});

// ── listInvoices ───────────────────────────────────────────────────────────────

describe("listInvoices", () => {
  it("returns paginated invoices for the firm", async () => {
    const record = makeInvoiceRecord();
    mockInvoice.count.mockResolvedValue(1);
    mockInvoice.findMany.mockResolvedValue([record]);

    const result = await listInvoices(actor, {}, { page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe("inv-1");
    expect(result.items[0].invoiceNumber).toBe("INV-2026-0001");
    expect(result.items[0].totalAmount).toBe("1100.00");
  });

  it("applies status filter when provided", async () => {
    mockInvoice.count.mockResolvedValue(0);
    mockInvoice.findMany.mockResolvedValue([]);

    await listInvoices(actor, { status: "ISSUED" }, { page: 1, limit: 10 });

    expect(mockInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ firmId: "firm-1", status: "ISSUED" })
      })
    );
  });

  it("applies caseId filter when provided", async () => {
    mockInvoice.count.mockResolvedValue(0);
    mockInvoice.findMany.mockResolvedValue([]);

    await listInvoices(actor, { caseId: "case-99" }, { page: 1, limit: 10 });

    expect(mockInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ caseId: "case-99" })
      })
    );
  });

  it("maps decimal amounts to fixed-precision strings", async () => {
    mockInvoice.count.mockResolvedValue(1);
    mockInvoice.findMany.mockResolvedValue([makeInvoiceRecord()]);

    const result = await listInvoices(actor, {}, { page: 1, limit: 10 });

    expect(result.items[0].subtotalAmount).toBe("1000.00");
    expect(result.items[0].taxAmount).toBe("100.00");
    expect(result.items[0].totalAmount).toBe("1100.00");
  });
});

// ── getInvoice ────────────────────────────────────────────────────────────────

describe("getInvoice", () => {
  it("returns the mapped invoice DTO", async () => {
    mockInvoice.findFirstOrThrow.mockResolvedValue(makeInvoiceRecord());

    const result = await getInvoice(actor, "inv-1");

    expect(result.id).toBe("inv-1");
    expect(result.status).toBe("DRAFT");
    expect(result.items).toHaveLength(1);
    expect(result.payments).toHaveLength(0);
  });

  it("queries by id and firmId for tenant isolation", async () => {
    mockInvoice.findFirstOrThrow.mockResolvedValue(makeInvoiceRecord());

    await getInvoice(actor, "inv-1");

    expect(mockInvoice.findFirstOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: "inv-1", firmId: "firm-1" }) })
    );
  });
});

// ── createInvoice ─────────────────────────────────────────────────────────────

describe("createInvoice", () => {
  it("creates invoice in DRAFT status with computed totals", async () => {
    mockInvoice.findFirst.mockResolvedValue(null); // no existing invoices for numbering
    const created = makeInvoiceRecord();
    mockInvoice.create.mockResolvedValue(created);

    const payload = {
      feeType: "FIXED",
      items: [{ description: "Legal fees", quantity: 1, unitPrice: "1000.00" }]
    };

    const result = await createInvoice(actor, payload, audit);

    expect(mockInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firmId: "firm-1", status: "DRAFT" })
      })
    );
    expect(result.status).toBe("DRAFT");
  });

  it("assigns a sequential invoice number", async () => {
    mockInvoice.findFirst.mockResolvedValue({
      invoiceNumber: "INV-2026-0003"
    });
    mockInvoice.create.mockResolvedValue(makeInvoiceRecord({ invoiceNumber: "INV-2026-0004" }));

    await createInvoice(actor, { feeType: "FIXED", items: [{ description: "x", quantity: 1, unitPrice: "100" }] }, audit);

    expect(mockInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ invoiceNumber: "INV-2026-0004" })
      })
    );
  });
});

// ── issueInvoice ──────────────────────────────────────────────────────────────

describe("issueInvoice", () => {
  it("transitions DRAFT invoice to ISSUED", async () => {
    mockInvoice.findFirstOrThrow.mockResolvedValue(makeInvoiceRecord({ status: "DRAFT", issuedAt: null }));
    mockInvoice.update.mockResolvedValue(makeInvoiceRecord({ status: "ISSUED", issuedAt: now }));

    const result = await issueInvoice(actor, "inv-1", audit);

    expect(mockInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "inv-1", firmId: "firm-1" }),
        data: expect.objectContaining({ status: "ISSUED" })
      })
    );
    expect(result.status).toBe("ISSUED");
  });

  it("rejects issuing a non-DRAFT invoice", async () => {
    mockInvoice.findFirstOrThrow.mockResolvedValue(makeInvoiceRecord({ status: "ISSUED" }));

    await expect(issueInvoice(actor, "inv-1", audit)).rejects.toThrow("Only DRAFT invoices can be issued");
  });
});

// ── voidInvoice ───────────────────────────────────────────────────────────────

describe("voidInvoice", () => {
  it("sets invoice status to VOID", async () => {
    mockInvoice.update.mockResolvedValue(makeInvoiceRecord({ status: "VOID" }));

    const result = await voidInvoice(actor, "inv-1", audit);

    expect(mockInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "inv-1", firmId: "firm-1" }),
        data: expect.objectContaining({ status: "VOID" })
      })
    );
    expect(result.status).toBe("VOID");
  });
});

// ── deleteInvoice ─────────────────────────────────────────────────────────────

describe("deleteInvoice", () => {
  it("deletes a DRAFT invoice", async () => {
    mockInvoice.findFirstOrThrow.mockResolvedValue(makeInvoiceRecord({ status: "DRAFT" }));
    mockInvoice.delete = vi.fn().mockResolvedValue({});

    await expect(deleteInvoice(actor, "inv-1", audit)).resolves.not.toThrow();
    expect(mockInvoice.delete).toHaveBeenCalledWith({ where: { id: "inv-1", firmId: "firm-1" } });
  });

  it("rejects deleting a non-DRAFT invoice", async () => {
    mockInvoice.findFirstOrThrow.mockResolvedValue(makeInvoiceRecord({ status: "ISSUED" }));

    await expect(deleteInvoice(actor, "inv-1", audit)).rejects.toThrow("Only DRAFT invoices can be deleted");
  });
});

// ── addPayment ────────────────────────────────────────────────────────────────

describe("addPayment", () => {
  it("sets status to PAID when payment covers full amount", async () => {
    mockInvoice.findFirstOrThrow.mockResolvedValue(
      makeInvoiceRecord({ status: "ISSUED", totalAmount: new Decimal("1100.00"), payments: [] })
    );
    mockPayment.create.mockResolvedValue({});
    mockPayment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: new Decimal("1100.00") }]);
    mockInvoice.update.mockResolvedValue(makeInvoiceRecord({ status: "PAID" }));

    const result = await addPayment(actor, "inv-1", { amount: "1100.00", method: "BANK_TRANSFER" }, audit);

    expect(mockInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "inv-1", firmId: "firm-1" }),
        data: expect.objectContaining({ status: "PAID" })
      })
    );
    expect(result.status).toBe("PAID");
  });

  it("sets status to PARTIALLY_PAID when payment is partial", async () => {
    mockInvoice.findFirstOrThrow.mockResolvedValue(
      makeInvoiceRecord({ status: "ISSUED", totalAmount: new Decimal("1100.00"), payments: [] })
    );
    mockPayment.create.mockResolvedValue({});
    mockPayment.findMany
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ amount: new Decimal("500.00") }]);
    mockInvoice.update.mockResolvedValue(makeInvoiceRecord({ status: "PARTIALLY_PAID" }));

    const result = await addPayment(actor, "inv-1", { amount: "500.00", method: "CASH" }, audit);

    expect(mockInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "inv-1", firmId: "firm-1" }),
        data: expect.objectContaining({ status: "PARTIALLY_PAID" })
      })
    );
    expect(result.status).toBe("PARTIALLY_PAID");
  });

  it("rejects payment on a voided invoice", async () => {
    mockInvoice.findFirstOrThrow.mockResolvedValue(
      makeInvoiceRecord({ status: "VOID", payments: [] })
    );

    await expect(
      addPayment(actor, "inv-1", { amount: "100.00", method: "CASH" }, audit)
    ).rejects.toThrow("Cannot add payment to a voided invoice");
  });
});

// ── listExpenses / createExpense / deleteExpense ──────────────────────────────

describe("listExpenses", () => {
  it("returns expenses for the firm", async () => {
    mockExpense.count.mockResolvedValue(1);
    mockExpense.findMany.mockResolvedValue([makeExpenseRecord()]);

    const result = await listExpenses(actor, {}, { page: 1, limit: 20 });

    expect(result.total).toBe(1);
    expect(result.items[0].id).toBe("exp-1");
    expect(result.items[0].amount).toBe("250.00");
  });
});

describe("createExpense", () => {
  it("creates expense and writes audit log", async () => {
    const record = makeExpenseRecord();
    mockExpense.create.mockResolvedValue(record);

    const result = await createExpense(
      actor,
      { category: "COURT_FEES", amount: "250.00", caseId: "case-1" },
      audit
    );

    expect(mockExpense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ firmId: "firm-1", category: "COURT_FEES" })
      })
    );
    expect(result.id).toBe("exp-1");
  });
});

describe("deleteExpense", () => {
  it("deletes the expense", async () => {
    mockExpense.delete = vi.fn().mockResolvedValue({});

    await expect(deleteExpense(actor, "exp-1", audit)).resolves.not.toThrow();
    expect(mockExpense.delete).toHaveBeenCalledWith({ where: { id: "exp-1", firmId: "firm-1" } });
  });
});

// ── getCaseBillingSummary ─────────────────────────────────────────────────────

describe("getCaseBillingSummary", () => {
  it("computes totals correctly from invoices and expenses", async () => {
    mockInvoice.findMany.mockResolvedValue([
      makeInvoiceRecord({
        totalAmount: new Decimal("1100.00"),
        payments: [{ amount: new Decimal("600.00") }],
        status: "PARTIALLY_PAID"
      })
    ]);
    mockExpense.findMany.mockResolvedValue([
      makeExpenseRecord({ amount: new Decimal("250.00") })
    ]);

    const result = await getCaseBillingSummary(actor, "case-1");

    expect(result.caseId).toBe("case-1");
    expect(result.totalBilled).toBe("1100.00");
    expect(result.totalPaid).toBe("600.00");
    expect(result.outstanding).toBe("500.00");
    expect(result.totalExpenses).toBe("250.00");
    expect(result.profitability).toBe("350.00"); // 600 - 250
    expect(result.invoiceCount).toBe(1);
    expect(result.expenseCount).toBe(1);
  });

  it("excludes voided invoices from summary", async () => {
    mockInvoice.findMany.mockResolvedValue([]); // VOID invoices filtered out by where clause
    mockExpense.findMany.mockResolvedValue([]);

    const result = await getCaseBillingSummary(actor, "case-1");

    expect(result.totalBilled).toBe("0.00");
    expect(result.invoiceCount).toBe(0);

    // Verify the query excluded VOID status
    expect(mockInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { not: "VOID" } })
      })
    );
  });
});
