import type { Expense, Invoice, InvoiceStatus as PrismaInvoiceStatus, Prisma } from "@prisma/client";
import type { RepositoryTx } from "../types.js";

export const invoiceInclude = {
  case: { select: { title: true } },
  client: { select: { name: true } },
  items: true,
  payments: true,
  creditApplications: {
    select: {
      id: true,
      amount: true,
      paymentId: true,
      createdAt: true
    }
  }
} as const;

export const expenseInclude = {
  case: { select: { title: true } }
} as const;

export type InvoiceRecord = Prisma.InvoiceGetPayload<{ include: typeof invoiceInclude }>;
export type ExpenseRecord = Prisma.ExpenseGetPayload<{ include: typeof expenseInclude }>;

export async function findLatestInvoiceNumberWithPrefix(
  tx: RepositoryTx,
  firmId: string,
  prefix: string
): Promise<string | null> {
  const latest = await tx.invoice.findFirst({
    where: { firmId, invoiceNumber: { startsWith: prefix } },
    orderBy: { invoiceNumber: "desc" },
    select: { invoiceNumber: true }
  });

  return latest?.invoiceNumber ?? null;
}

export async function listFirmInvoices(
  tx: RepositoryTx,
  where: Prisma.InvoiceWhereInput,
  orderBy: Prisma.InvoiceOrderByWithRelationInput | Prisma.InvoiceOrderByWithRelationInput[],
  pagination: { page: number; limit: number }
): Promise<{ total: number; items: InvoiceRecord[] }> {
  const { page, limit } = pagination;
  const [items, total] = await Promise.all([
    tx.invoice.findMany({
      where,
      include: invoiceInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    }),
    tx.invoice.count({ where })
  ]);

  return { total, items };
}

export async function getFirmInvoiceByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  id: string
): Promise<InvoiceRecord> {
  return tx.invoice.findFirstOrThrow({
    where: { id, firmId },
    include: invoiceInclude
  });
}

export async function getFirmInvoiceRowByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  id: string
): Promise<Invoice> {
  return tx.invoice.findFirstOrThrow({ where: { id, firmId } });
}

export async function createInvoiceWithItems(
  tx: RepositoryTx,
  data: {
    firmId: string;
    caseId: string | null;
    clientId: string | null;
    invoiceNumber: string;
    status: PrismaInvoiceStatus;
    feeType: string;
    subtotalAmount: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    discountAmount: Prisma.Decimal;
    totalAmount: Prisma.Decimal;
    issuedAt: Date | null;
    dueDate: Date | null;
    items: Array<{
      description: string;
      quantity: number;
      unitPrice: Prisma.Decimal;
      total: Prisma.Decimal;
    }>;
  }
): Promise<InvoiceRecord> {
  return tx.invoice.create({
    data: {
      firmId: data.firmId,
      caseId: data.caseId,
      clientId: data.clientId,
      invoiceNumber: data.invoiceNumber,
      status: data.status,
      feeType: data.feeType,
      subtotalAmount: data.subtotalAmount,
      taxAmount: data.taxAmount,
      discountAmount: data.discountAmount,
      totalAmount: data.totalAmount,
      issuedAt: data.issuedAt,
      dueDate: data.dueDate,
      items: { create: data.items }
    },
    include: invoiceInclude
  });
}

export async function replaceInvoiceItems(
  tx: RepositoryTx,
  invoiceId: string,
  items: Array<{
    invoiceId: string;
    description: string;
    quantity: number;
    unitPrice: Prisma.Decimal;
    total: Prisma.Decimal;
  }>
): Promise<void> {
  await tx.invoiceItem.deleteMany({ where: { invoiceId } });
  await tx.invoiceItem.createMany({ data: items });
}

export async function updateFirmInvoiceById(
  tx: RepositoryTx,
  id: string,
  firmId: string,
  data: Prisma.InvoiceUpdateInput
): Promise<InvoiceRecord> {
  return tx.invoice.update({ where: { id, firmId }, data, include: invoiceInclude });
}

export async function deleteInvoiceById(tx: RepositoryTx, id: string, firmId: string): Promise<void> {
  await tx.invoice.delete({ where: { id, firmId } });
}

export async function createPayment(
  tx: RepositoryTx,
  data: {
    invoiceId: string;
    amount: Prisma.Decimal;
    method: string;
    referenceNumber: string | null;
    paidAt: Date;
  }
): Promise<{ id: string }> {
  return tx.payment.create({ data, select: { id: true } });
}

export async function listInvoicePayments(
  tx: RepositoryTx,
  invoiceId: string
): Promise<Array<{ amount: Prisma.Decimal }>> {
  return tx.payment.findMany({
    where: { invoiceId },
    select: { amount: true }
  });
}

export async function listInvoiceCreditApplications(
  tx: RepositoryTx,
  invoiceId: string
): Promise<Array<{ amount: Prisma.Decimal }>> {
  return tx.invoiceCreditApplication.findMany({
    where: { invoiceId },
    select: { amount: true }
  });
}

export async function createInvoiceCreditApplication(
  tx: RepositoryTx,
  data: {
    firmId: string;
    invoiceId: string;
    clientId: string;
    paymentId: string | null;
    amount: Prisma.Decimal;
  }
): Promise<void> {
  await tx.invoiceCreditApplication.create({ data });
}

export async function getClientCreditBalance(
  tx: RepositoryTx,
  firmId: string,
  clientId: string
): Promise<{ availableAmount: Prisma.Decimal } | null> {
  return tx.clientCreditBalance.findUnique({
    where: { firmId_clientId: { firmId, clientId } },
    select: { availableAmount: true }
  });
}

export async function incrementClientCreditBalance(
  tx: RepositoryTx,
  firmId: string,
  clientId: string,
  amount: Prisma.Decimal
): Promise<void> {
  await tx.clientCreditBalance.upsert({
    where: { firmId_clientId: { firmId, clientId } },
    update: { availableAmount: { increment: amount } },
    create: {
      firmId,
      clientId,
      availableAmount: amount
    }
  });
}

export async function decrementClientCreditBalance(
  tx: RepositoryTx,
  firmId: string,
  clientId: string,
  amount: Prisma.Decimal
): Promise<boolean> {
  const updated = await tx.clientCreditBalance.updateMany({
    where: {
      firmId,
      clientId,
      availableAmount: { gte: amount }
    },
    data: {
      availableAmount: { decrement: amount }
    }
  });
  return updated.count > 0;
}

export async function createClientCreditEntry(
  tx: RepositoryTx,
  data: {
    firmId: string;
    clientId: string;
    invoiceId: string | null;
    type: string;
    amount: Prisma.Decimal;
    note: string | null;
  }
): Promise<void> {
  await tx.clientCreditEntry.create({ data });
}

export async function listFirmExpenses(
  tx: RepositoryTx,
  where: Prisma.ExpenseWhereInput,
  orderBy: Prisma.ExpenseOrderByWithRelationInput,
  pagination: { page: number; limit: number }
): Promise<{ total: number; items: ExpenseRecord[] }> {
  const { page, limit } = pagination;
  const [items, total] = await Promise.all([
    tx.expense.findMany({
      where,
      include: expenseInclude,
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    }),
    tx.expense.count({ where })
  ]);

  return { total, items };
}

export async function getFirmExpenseByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  id: string
): Promise<ExpenseRecord> {
  return tx.expense.findFirstOrThrow({
    where: { id, firmId },
    include: expenseInclude
  });
}

export async function createExpense(
  tx: RepositoryTx,
  data: {
    firmId: string;
    caseId: string | null;
    category: string;
    amount: Prisma.Decimal;
    description: string | null;
    receiptDocumentId: string | null;
  }
): Promise<ExpenseRecord> {
  return tx.expense.create({
    data,
    include: expenseInclude
  });
}

export async function updateExpenseById(
  tx: RepositoryTx,
  id: string,
  firmId: string,
  data: Prisma.ExpenseUpdateInput
): Promise<ExpenseRecord> {
  return tx.expense.update({
    where: { id, firmId },
    data,
    include: expenseInclude
  });
}

export async function deleteExpenseById(
  tx: RepositoryTx,
  id: string,
  firmId: string
): Promise<void> {
  await tx.expense.delete({ where: { id, firmId } });
}

export async function listCaseInvoicesWithPayments(
  tx: RepositoryTx,
  firmId: string,
  caseId: string
): Promise<Array<Prisma.InvoiceGetPayload<{ include: { payments: true; creditApplications: true } }>>> {
  return tx.invoice.findMany({
    where: { caseId, firmId, status: { not: "VOID" } },
    include: { payments: true, creditApplications: true }
  });
}

export async function listCaseExpenses(
  tx: RepositoryTx,
  firmId: string,
  caseId: string
): Promise<Expense[]> {
  return tx.expense.findMany({ where: { caseId, firmId } });
}
