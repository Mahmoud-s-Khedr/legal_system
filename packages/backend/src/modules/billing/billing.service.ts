import type {
  BillingSummaryDto,
  CreateExpenseDto,
  CreateInvoiceDto,
  CreatePaymentDto,
  ExpenseDto,
  ExpenseListResponseDto,
  InvoiceDto,
  InvoiceItemDto,
  InvoiceListResponseDto,
  PaymentDto,
  SessionUser,
  UpdateExpenseDto,
  UpdateInvoiceDto
} from "@elms/shared";
import { InvoiceStatus } from "@elms/shared";
import type { InvoiceStatus as PrismaInvoiceStatus, Prisma } from "@prisma/client";
import { writeAuditLog, type AuditContext } from "../../services/audit.service.js";
import { Decimal } from "@prisma/client/runtime/library";
import { normalizeSort, toPrismaSortOrder, type SortDir } from "../../utils/tableQuery.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  createExpense as createExpenseRecord,
  createInvoiceWithItems,
  createPayment,
  deleteExpenseById,
  deleteInvoiceById,
  getFirmExpenseByIdOrThrow,
  getFirmInvoiceByIdOrThrow,
  getFirmInvoiceRowByIdOrThrow,
  listCaseExpenses,
  listCaseInvoicesWithPayments,
  listFirmExpenses,
  listFirmInvoices,
  listInvoicePayments,
  findLatestInvoiceNumberWithPrefix,
  replaceInvoiceItems,
  updateExpenseById,
  updateFirmInvoiceById
} from "../../repositories/billing/billing.repository.js";

// ── Mappers ───────────────────────────────────────────────────────────────────

function mapItem(item: {
  id: string;
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: Decimal;
  total: Decimal;
}): InvoiceItemDto {
  return {
    id: item.id,
    invoiceId: item.invoiceId,
    description: item.description,
    quantity: item.quantity,
    unitPrice: item.unitPrice.toFixed(2),
    total: item.total.toFixed(2)
  };
}

function mapPayment(p: {
  id: string;
  invoiceId: string;
  amount: Decimal;
  method: string;
  referenceNumber: string | null;
  paidAt: Date;
  createdAt: Date;
}): PaymentDto {
  return {
    id: p.id,
    invoiceId: p.invoiceId,
    amount: p.amount.toFixed(2),
    method: p.method,
    referenceNumber: p.referenceNumber,
    paidAt: p.paidAt.toISOString(),
    createdAt: p.createdAt.toISOString()
  };
}

function mapInvoice(inv: {
  id: string;
  firmId: string;
  caseId: string | null;
  clientId: string | null;
  invoiceNumber: string;
  status: PrismaInvoiceStatus;
  feeType: string;
  subtotalAmount: Decimal;
  taxAmount: Decimal;
  discountAmount: Decimal;
  totalAmount: Decimal;
  issuedAt: Date | null;
  dueDate: Date | null;
  createdAt: Date;
  updatedAt: Date;
  case: { title: string } | null;
  client: { name: string } | null;
  items: Parameters<typeof mapItem>[0][];
  payments: Parameters<typeof mapPayment>[0][];
}): InvoiceDto {
  return {
    id: inv.id,
    firmId: inv.firmId,
    caseId: inv.caseId,
    caseTitle: inv.case?.title ?? null,
    clientId: inv.clientId,
    clientName: inv.client?.name ?? null,
    invoiceNumber: inv.invoiceNumber,
    status: inv.status as InvoiceStatus,
    feeType: inv.feeType,
    subtotalAmount: inv.subtotalAmount.toFixed(2),
    taxAmount: inv.taxAmount.toFixed(2),
    discountAmount: inv.discountAmount.toFixed(2),
    totalAmount: inv.totalAmount.toFixed(2),
    issuedAt: inv.issuedAt?.toISOString() ?? null,
    dueDate: inv.dueDate?.toISOString() ?? null,
    items: inv.items.map(mapItem),
    payments: inv.payments.map(mapPayment),
    createdAt: inv.createdAt.toISOString(),
    updatedAt: inv.updatedAt.toISOString()
  };
}

function mapExpense(exp: {
  id: string;
  firmId: string;
  caseId: string | null;
  category: string;
  amount: Decimal;
  description: string | null;
  receiptDocumentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  case: { title: string } | null;
}): ExpenseDto {
  return {
    id: exp.id,
    firmId: exp.firmId,
    caseId: exp.caseId,
    caseTitle: exp.case?.title ?? null,
    category: exp.category,
    amount: exp.amount.toFixed(2),
    description: exp.description,
    receiptDocumentId: exp.receiptDocumentId,
    createdAt: exp.createdAt.toISOString(),
    updatedAt: exp.updatedAt.toISOString()
  };
}

// ── Invoice Number ────────────────────────────────────────────────────────────

async function nextInvoiceNumber(tx: Prisma.TransactionClient, firmId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;
  const latest = await findLatestInvoiceNumberWithPrefix(tx, firmId, prefix);
  const seq = latest ? parseInt(latest.slice(prefix.length), 10) + 1 : 1;
  return `${prefix}${String(seq).padStart(4, "0")}`;
}

// ── Invoice totals ────────────────────────────────────────────────────────────

function computeSubtotal(items: { quantity: number; unitPrice: string }[]): Decimal {
  return items.reduce((sum, item) => {
    const itemTotal = new Decimal(item.unitPrice).mul(item.quantity);
    return sum.add(itemTotal);
  }, new Decimal(0));
}

function computeTotal(subtotal: Decimal, tax: Decimal, discount: Decimal): Decimal {
  return subtotal.add(tax).sub(discount);
}

function deriveStatus(totalAmount: Decimal, payments: { amount: Decimal }[]): PrismaInvoiceStatus {
  const paid = payments.reduce((sum, p) => sum.add(p.amount), new Decimal(0));
  if (paid.gte(totalAmount)) return "PAID";
  if (paid.gt(0)) return "PARTIALLY_PAID";
  return "ISSUED";
}

// ── List ──────────────────────────────────────────────────────────────────────

export async function listInvoices(
  actor: SessionUser,
  filters: {
    q?: string;
    caseId?: string;
    clientId?: string;
    status?: string;
    from?: string;
    to?: string;
    sortBy?: string;
    sortDir?: SortDir;
  },
  pagination: { page: number; limit: number } = { page: 1, limit: 50 }
): Promise<InvoiceListResponseDto> {
  const { page, limit } = pagination;
  const q = filters.q?.trim();
  const fromDate = filters.from ? new Date(filters.from) : null;
  const toDate = filters.to ? new Date(filters.to) : null;
  const sortBy = normalizeSort(
    filters.sortBy,
    ["createdAt", "dueDate", "issuedAt", "totalAmount", "invoiceNumber", "status"] as const,
    "createdAt"
  );
  const sortDir = toPrismaSortOrder(filters.sortDir ?? "desc");
  const where: Prisma.InvoiceWhereInput = {
    firmId: actor.firmId,
    ...(filters.caseId ? { caseId: filters.caseId } : {}),
    ...(filters.clientId ? { clientId: filters.clientId } : {}),
    ...(filters.status ? { status: filters.status as PrismaInvoiceStatus } : {}),
    ...(q
      ? {
          OR: [
            { invoiceNumber: { contains: q, mode: "insensitive" as const } },
            { feeType: { contains: q, mode: "insensitive" as const } },
            { client: { name: { contains: q, mode: "insensitive" as const } } },
            { case: { title: { contains: q, mode: "insensitive" as const } } }
          ]
        }
      : {}),
    ...(fromDate || toDate
      ? {
          OR: [
            {
              dueDate: {
                ...(fromDate ? { gte: fromDate } : {}),
                ...(toDate ? { lte: toDate } : {})
              }
            },
            {
              AND: [
                { dueDate: null },
                {
                  issuedAt: {
                    ...(fromDate ? { gte: fromDate } : {}),
                    ...(toDate ? { lte: toDate } : {})
                  }
                }
              ]
            }
          ]
        }
      : {})
  };
  return inTenantTransaction(actor.firmId, async (tx) => {
    const { items, total } = await listFirmInvoices(
      tx,
      where,
      sortBy === "dueDate" ? [{ dueDate: sortDir }, { createdAt: "desc" }] : { [sortBy]: sortDir },
      { page, limit }
    );

    return { items: items.map(mapInvoice), total, page, pageSize: limit };
  });
}

export async function getInvoice(actor: SessionUser, id: string): Promise<InvoiceDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const inv = await getFirmInvoiceByIdOrThrow(tx, actor.firmId, id);
    return mapInvoice(inv);
  });
}

export async function createInvoice(
  actor: SessionUser,
  payload: CreateInvoiceDto,
  audit: AuditContext
): Promise<InvoiceDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const invoiceNumber = await nextInvoiceNumber(tx, actor.firmId);
    const taxAmount = new Decimal(payload.taxAmount ?? "0");
    const discountAmount = new Decimal(payload.discountAmount ?? "0");
    const itemsData = payload.items.map((i) => ({
      description: i.description,
      quantity: i.quantity ?? 1,
      unitPrice: new Decimal(i.unitPrice),
      total: new Decimal(i.unitPrice).mul(i.quantity ?? 1)
    }));
    const subtotal = computeSubtotal(itemsData.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice.toFixed(2) })));
    const total = computeTotal(subtotal, taxAmount, discountAmount);

    const inv = await createInvoiceWithItems(tx, {
      firmId: actor.firmId,
      caseId: payload.caseId ?? null,
      clientId: payload.clientId ?? null,
      invoiceNumber,
      status: "DRAFT",
      feeType: payload.feeType ?? "FIXED",
      subtotalAmount: subtotal,
      taxAmount,
      discountAmount,
      totalAmount: total,
      issuedAt: payload.issuedAt ? new Date(payload.issuedAt) : null,
      dueDate: payload.dueDate ? new Date(payload.dueDate) : null,
      items: itemsData
    });

    await writeAuditLog(tx, audit, { action: "invoice.created", entityType: "Invoice", entityId: inv.id });

    return mapInvoice(inv);
  });
}

export async function updateInvoice(
  actor: SessionUser,
  id: string,
  payload: UpdateInvoiceDto,
  audit: AuditContext
): Promise<InvoiceDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmInvoiceRowByIdOrThrow(tx, actor.firmId, id);
    if (existing.status === "VOID") throw new Error("Cannot update a voided invoice");

    const taxAmount = new Decimal(payload.taxAmount ?? existing.taxAmount.toFixed(2));
    const discountAmount = new Decimal(payload.discountAmount ?? existing.discountAmount.toFixed(2));

    const updateData: Record<string, unknown> = {
      feeType: payload.feeType ?? existing.feeType,
      taxAmount,
      discountAmount,
      issuedAt: payload.issuedAt !== undefined ? (payload.issuedAt ? new Date(payload.issuedAt) : null) : existing.issuedAt,
      dueDate: payload.dueDate !== undefined ? (payload.dueDate ? new Date(payload.dueDate) : null) : existing.dueDate
    };

    if (payload.items) {
      const itemsData = payload.items.map((i) => ({
        invoiceId: id,
        description: i.description,
        quantity: i.quantity ?? 1,
        unitPrice: new Decimal(i.unitPrice),
        total: new Decimal(i.unitPrice).mul(i.quantity ?? 1)
      }));
      await replaceInvoiceItems(tx, id, itemsData);
      const subtotal = computeSubtotal(
        itemsData.map((i) => ({ quantity: i.quantity, unitPrice: i.unitPrice.toFixed(2) }))
      );
      updateData.subtotalAmount = subtotal;
      updateData.totalAmount = computeTotal(subtotal, taxAmount, discountAmount);
    } else {
      updateData.totalAmount = computeTotal(existing.subtotalAmount, taxAmount, discountAmount);
    }

    const inv = await updateFirmInvoiceById(tx, id, actor.firmId, updateData as Prisma.InvoiceUpdateInput);

    await writeAuditLog(tx, audit, { action: "invoice.updated", entityType: "Invoice", entityId: id });

    return mapInvoice(inv);
  });
}

export async function issueInvoice(actor: SessionUser, id: string, audit: AuditContext): Promise<InvoiceDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmInvoiceRowByIdOrThrow(tx, actor.firmId, id);
    if (existing.status !== "DRAFT") throw new Error("Only DRAFT invoices can be issued");
    const inv = await updateFirmInvoiceById(tx, id, actor.firmId, {
      status: "ISSUED",
      issuedAt: existing.issuedAt ?? new Date()
    });
    await writeAuditLog(tx, audit, { action: "invoice.issued", entityType: "Invoice", entityId: id });
    return mapInvoice(inv);
  });
}

export async function voidInvoice(actor: SessionUser, id: string, audit: AuditContext): Promise<InvoiceDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const inv = await updateFirmInvoiceById(tx, id, actor.firmId, { status: "VOID" });
    await writeAuditLog(tx, audit, { action: "invoice.voided", entityType: "Invoice", entityId: id });
    return mapInvoice(inv);
  });
}

export async function deleteInvoice(actor: SessionUser, id: string, audit: AuditContext): Promise<void> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const existing = await getFirmInvoiceRowByIdOrThrow(tx, actor.firmId, id);
    if (existing.status !== "DRAFT") throw new Error("Only DRAFT invoices can be deleted");
    await deleteInvoiceById(tx, id, actor.firmId);
    await writeAuditLog(tx, audit, { action: "invoice.deleted", entityType: "Invoice", entityId: id });
  });
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function addPayment(
  actor: SessionUser,
  invoiceId: string,
  payload: CreatePaymentDto,
  audit: AuditContext
): Promise<InvoiceDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const invoice = await getFirmInvoiceByIdOrThrow(tx, actor.firmId, invoiceId);
    if (invoice.status === "VOID") throw new Error("Cannot add payment to a voided invoice");

    await createPayment(tx, {
      invoiceId,
      amount: new Decimal(payload.amount),
      method: payload.method,
      referenceNumber: payload.referenceNumber ?? null,
      paidAt: payload.paidAt ? new Date(payload.paidAt) : new Date()
    });

    const allPayments = await listInvoicePayments(tx, invoiceId);
    const newStatus = deriveStatus(invoice.totalAmount, allPayments);
    const inv = await updateFirmInvoiceById(tx, invoiceId, actor.firmId, { status: newStatus });

    await writeAuditLog(tx, audit, { action: "payment.added", entityType: "Invoice", entityId: invoiceId });
    return mapInvoice(inv);
  });
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function listExpenses(
  actor: SessionUser,
  filters: {
    q?: string;
    caseId?: string;
    category?: string;
    sortBy?: string;
    sortDir?: SortDir;
  },
  pagination: { page: number; limit: number } = { page: 1, limit: 50 }
): Promise<ExpenseListResponseDto> {
  const { page, limit } = pagination;
  const q = filters.q?.trim();
  const sortBy = normalizeSort(filters.sortBy, ["createdAt", "updatedAt", "amount", "category"] as const, "createdAt");
  const sortDir = toPrismaSortOrder(filters.sortDir ?? "desc");
  const where: Prisma.ExpenseWhereInput = {
    firmId: actor.firmId,
    ...(filters.caseId ? { caseId: filters.caseId } : {}),
    ...(filters.category ? { category: filters.category } : {}),
    ...(q
      ? {
          OR: [
            { category: { contains: q, mode: "insensitive" as const } },
            { description: { contains: q, mode: "insensitive" as const } },
            { case: { title: { contains: q, mode: "insensitive" as const } } }
          ]
        }
      : {})
  };
  return inTenantTransaction(actor.firmId, async (tx) => {
    const { items, total } = await listFirmExpenses(tx, where, { [sortBy]: sortDir }, { page, limit });
    return { items: items.map(mapExpense), total, page, pageSize: limit };
  });
}

export async function getExpense(actor: SessionUser, id: string): Promise<ExpenseDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const exp = await getFirmExpenseByIdOrThrow(tx, actor.firmId, id);
    return mapExpense(exp);
  });
}

export async function createExpense(
  actor: SessionUser,
  payload: CreateExpenseDto,
  audit: AuditContext
): Promise<ExpenseDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const exp = await createExpenseRecord(tx, {
      firmId: actor.firmId,
      caseId: payload.caseId ?? null,
      category: payload.category,
      amount: new Decimal(payload.amount),
      description: payload.description ?? null,
      receiptDocumentId: payload.receiptDocumentId ?? null
    });
    await writeAuditLog(tx, audit, { action: "expense.created", entityType: "Expense", entityId: exp.id });
    return mapExpense(exp);
  });
}

export async function updateExpense(
  actor: SessionUser,
  id: string,
  payload: UpdateExpenseDto,
  audit: AuditContext
): Promise<ExpenseDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const exp = await updateExpenseById(tx, id, actor.firmId, {
      ...(payload.caseId !== undefined ? { caseId: payload.caseId } : {}),
      ...(payload.category !== undefined ? { category: payload.category } : {}),
      ...(payload.amount !== undefined ? { amount: new Decimal(payload.amount) } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
      ...(payload.receiptDocumentId !== undefined ? { receiptDocumentId: payload.receiptDocumentId } : {})
    });
    await writeAuditLog(tx, audit, { action: "expense.updated", entityType: "Expense", entityId: id });
    return mapExpense(exp);
  });
}

export async function deleteExpense(actor: SessionUser, id: string, audit: AuditContext): Promise<void> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    await deleteExpenseById(tx, id, actor.firmId);
    await writeAuditLog(tx, audit, { action: "expense.deleted", entityType: "Expense", entityId: id });
  });
}

// ── Billing Summary ───────────────────────────────────────────────────────────

export async function getCaseBillingSummary(actor: SessionUser, caseId: string): Promise<BillingSummaryDto> {
  const { invoices, expenses } = await inTenantTransaction(actor.firmId, async (tx) => {
    const [invoiceRows, expenseRows] = await Promise.all([
      listCaseInvoicesWithPayments(tx, actor.firmId, caseId),
      listCaseExpenses(tx, actor.firmId, caseId)
    ]);
    return { invoices: invoiceRows, expenses: expenseRows };
  });

  const totalBilled = invoices.reduce((sum, inv) => sum.add(inv.totalAmount), new Decimal(0));
  const totalPaid = invoices.reduce(
    (sum, inv) => sum.add(inv.payments.reduce((ps, p) => ps.add(p.amount), new Decimal(0))),
    new Decimal(0)
  );
  const totalExpenses = expenses.reduce((sum, exp) => sum.add(exp.amount), new Decimal(0));

  return {
    caseId,
    totalBilled: totalBilled.toFixed(2),
    totalPaid: totalPaid.toFixed(2),
    outstanding: totalBilled.sub(totalPaid).toFixed(2),
    totalExpenses: totalExpenses.toFixed(2),
    profitability: totalPaid.sub(totalExpenses).toFixed(2),
    invoiceCount: invoices.length,
    expenseCount: expenses.length
  };
}
