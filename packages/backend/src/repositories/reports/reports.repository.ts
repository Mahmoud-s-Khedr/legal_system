import type { Prisma } from "@prisma/client";
import type { RepositoryTx } from "../types.js";

export async function queryCaseStatusDistribution(
  tx: RepositoryTx,
  firmId: string,
  filter: { dateFrom?: string; dateTo?: string }
): Promise<Array<{ status: string; count: bigint }>> {
  return tx.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*) AS count
      FROM "Case"
      WHERE "firmId" = ${firmId}::uuid
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR "createdAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR "createdAt" <= ${filter.dateTo ?? null}::timestamptz)
      GROUP BY status
      ORDER BY count DESC
    `;
}

export async function queryHearingOutcomes(
  tx: RepositoryTx,
  firmId: string,
  filter: { dateFrom?: string; dateTo?: string }
): Promise<Array<{ outcome: string | null; count: bigint }>> {
  return tx.$queryRaw<Array<{ outcome: string | null; count: bigint }>>`
      SELECT outcome, COUNT(*) AS count
      FROM "CaseSession"
      WHERE (${filter.dateFrom ?? null}::timestamptz IS NULL OR "sessionDatetime" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR "sessionDatetime" <= ${filter.dateTo ?? null}::timestamptz)
        AND EXISTS (
          SELECT 1
          FROM "Case" c
          WHERE c.id = "CaseSession"."caseId"
            AND c."firmId" = ${firmId}::uuid
        )
      GROUP BY outcome
      ORDER BY count DESC
    `;
}

export async function listActiveFirmUsers(
  tx: RepositoryTx,
  firmId: string
): Promise<Array<{ id: string; fullName: string }>> {
  return tx.user.findMany({
    where: { firmId, status: "ACTIVE" },
    select: { id: true, fullName: true }
  });
}

export async function countOpenAssignedCases(
  tx: RepositoryTx,
  firmId: string,
  userId: string
): Promise<number> {
  return tx.caseAssignment.count({
    where: {
      userId,
      unassignedAt: null,
      assignedCase: { firmId, status: "ACTIVE", deletedAt: null }
    }
  });
}

export async function countOpenAssignedTasks(
  tx: RepositoryTx,
  firmId: string,
  userId: string
): Promise<number> {
  return tx.task.count({
    where: {
      firmId,
      assignedToId: userId,
      status: { notIn: ["DONE", "CANCELLED"] }
    }
  });
}

export async function countUpcomingAssignedHearings(
  tx: RepositoryTx,
  firmId: string,
  userId: string,
  now: Date
): Promise<number> {
  return tx.caseSession.count({
    where: {
      case: { firmId, deletedAt: null },
      assignedLawyerId: userId,
      sessionDatetime: { gte: now }
    }
  });
}

export async function queryRevenueReport(
  tx: RepositoryTx,
  firmId: string,
  filter: { dateFrom?: string; dateTo?: string },
  options?: { caseIds?: string[] | null }
): Promise<Array<{ month: string; invoiced: string; paid: string }>> {
  const caseIds = options?.caseIds ?? null;
  return tx.$queryRaw<Array<{ month: string; invoiced: string; paid: string }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "issuedAt"), 'YYYY-MM') AS month,
        SUM("totalAmount")::text AS invoiced,
        SUM(CASE WHEN status IN ('PAID','PARTIALLY_PAID')
          THEN (SELECT COALESCE(SUM(amount), 0) FROM "Payment" p WHERE p."invoiceId" = "Invoice".id)
          ELSE 0 END)::text AS paid
      FROM "Invoice"
      WHERE "firmId" = ${firmId}::uuid
        AND status != 'VOID'
        AND "issuedAt" IS NOT NULL
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR "issuedAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR "issuedAt" <= ${filter.dateTo ?? null}::timestamptz)
        AND (
          ${caseIds}::uuid[] IS NULL
          OR "caseId" = ANY(${caseIds}::uuid[])
        )
      GROUP BY DATE_TRUNC('month', "issuedAt")
      ORDER BY month ASC
    `;
}

export async function queryEarningsLossesReport(
  tx: RepositoryTx,
  firmId: string,
  filter: { dateFrom?: string; dateTo?: string },
  options?: { caseIds?: string[] | null }
): Promise<
  Array<{
    month: string;
    cashEarnings: string;
    accrualEarnings: string;
    operatingExpenses: string;
    invoiceLosses: string;
    totalLosses: string;
    netProfitCash: string;
    netProfitAccrual: string;
  }>
> {
  const caseIds = options?.caseIds ?? null;
  return tx.$queryRaw<
    Array<{
      month: string;
      cashEarnings: string;
      accrualEarnings: string;
      operatingExpenses: string;
      invoiceLosses: string;
      totalLosses: string;
      netProfitCash: string;
      netProfitAccrual: string;
    }>
  >`
    WITH months AS (
      SELECT TO_CHAR(m, 'YYYY-MM') AS month
      FROM generate_series(
        DATE_TRUNC('month', COALESCE(${filter.dateFrom ?? null}::timestamptz, now() - interval '11 months')),
        DATE_TRUNC('month', COALESCE(${filter.dateTo ?? null}::timestamptz, now())),
        interval '1 month'
      ) m
    ),
    accrual AS (
      SELECT
        TO_CHAR(DATE_TRUNC('month', i."issuedAt"), 'YYYY-MM') AS month,
        COALESCE(SUM(i."totalAmount"), 0)::numeric(12,2) AS value
      FROM "Invoice" i
      WHERE i."firmId" = ${firmId}::uuid
        AND i.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID')
        AND i."issuedAt" IS NOT NULL
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR i."issuedAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR i."issuedAt" <= ${filter.dateTo ?? null}::timestamptz)
        AND (
          ${caseIds}::uuid[] IS NULL
          OR i."caseId" = ANY(${caseIds}::uuid[])
        )
      GROUP BY DATE_TRUNC('month', i."issuedAt")
    ),
    cash AS (
      SELECT
        TO_CHAR(DATE_TRUNC('month', p."paidAt"), 'YYYY-MM') AS month,
        COALESCE(SUM(p.amount), 0)::numeric(12,2) AS value
      FROM "Payment" p
      INNER JOIN "Invoice" i ON i.id = p."invoiceId"
      WHERE i."firmId" = ${firmId}::uuid
        AND i.status != 'VOID'
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR p."paidAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR p."paidAt" <= ${filter.dateTo ?? null}::timestamptz)
        AND (
          ${caseIds}::uuid[] IS NULL
          OR i."caseId" = ANY(${caseIds}::uuid[])
        )
      GROUP BY DATE_TRUNC('month', p."paidAt")
    ),
    expense AS (
      SELECT
        TO_CHAR(DATE_TRUNC('month', e."createdAt"), 'YYYY-MM') AS month,
        COALESCE(SUM(e.amount), 0)::numeric(12,2) AS value
      FROM "Expense" e
      WHERE e."firmId" = ${firmId}::uuid
        AND e."deletedAt" IS NULL
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR e."createdAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR e."createdAt" <= ${filter.dateTo ?? null}::timestamptz)
        AND (
          ${caseIds}::uuid[] IS NULL
          OR e."caseId" = ANY(${caseIds}::uuid[])
        )
      GROUP BY DATE_TRUNC('month', e."createdAt")
    ),
    invoice_void_loss AS (
      SELECT
        TO_CHAR(DATE_TRUNC('month', i."updatedAt"), 'YYYY-MM') AS month,
        COALESCE(SUM(i."totalAmount"), 0)::numeric(12,2) AS value
      FROM "Invoice" i
      WHERE i."firmId" = ${firmId}::uuid
        AND i.status = 'VOID'
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR i."updatedAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR i."updatedAt" <= ${filter.dateTo ?? null}::timestamptz)
        AND (
          ${caseIds}::uuid[] IS NULL
          OR i."caseId" = ANY(${caseIds}::uuid[])
        )
      GROUP BY DATE_TRUNC('month', i."updatedAt")
    ),
    credit_loss AS (
      SELECT
        TO_CHAR(DATE_TRUNC('month', a."createdAt"), 'YYYY-MM') AS month,
        COALESCE(SUM(a.amount), 0)::numeric(12,2) AS value
      FROM "InvoiceCreditApplication" a
      INNER JOIN "Invoice" i ON i.id = a."invoiceId"
      WHERE a."firmId" = ${firmId}::uuid
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR a."createdAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR a."createdAt" <= ${filter.dateTo ?? null}::timestamptz)
        AND (
          ${caseIds}::uuid[] IS NULL
          OR i."caseId" = ANY(${caseIds}::uuid[])
        )
      GROUP BY DATE_TRUNC('month', a."createdAt")
    ),
    invoice_loss AS (
      SELECT
        month,
        SUM(value)::numeric(12,2) AS value
      FROM (
        SELECT month, value FROM invoice_void_loss
        UNION ALL
        SELECT month, value FROM credit_loss
      ) x
      GROUP BY month
    )
    SELECT
      m.month,
      COALESCE(c.value, 0)::text AS "cashEarnings",
      COALESCE(a.value, 0)::text AS "accrualEarnings",
      COALESCE(e.value, 0)::text AS "operatingExpenses",
      COALESCE(l.value, 0)::text AS "invoiceLosses",
      (COALESCE(e.value, 0) + COALESCE(l.value, 0))::text AS "totalLosses",
      (COALESCE(c.value, 0) - (COALESCE(e.value, 0) + COALESCE(l.value, 0)))::text AS "netProfitCash",
      (COALESCE(a.value, 0) - (COALESCE(e.value, 0) + COALESCE(l.value, 0)))::text AS "netProfitAccrual"
    FROM months m
    LEFT JOIN cash c ON c.month = m.month
    LEFT JOIN accrual a ON a.month = m.month
    LEFT JOIN expense e ON e.month = m.month
    LEFT JOIN invoice_loss l ON l.month = m.month
    ORDER BY m.month ASC
  `;
}

export async function queryDsoCollectionLagReport(
  tx: RepositoryTx,
  firmId: string,
  filter: { dateFrom?: string; dateTo?: string },
  options?: { caseIds?: string[] | null }
): Promise<Array<{ month: string; paidInvoices: string; avgCollectionDays: string }>> {
  const caseIds = options?.caseIds ?? null;
  return tx.$queryRaw<Array<{ month: string; paidInvoices: string; avgCollectionDays: string }>>`
    WITH paid_dates AS (
      SELECT
        i.id AS invoice_id,
        i."issuedAt" AS issued_at,
        MAX(p."paidAt") AS paid_at
      FROM "Invoice" i
      INNER JOIN "Payment" p ON p."invoiceId" = i.id
      WHERE i."firmId" = ${firmId}::uuid
        AND i.status = 'PAID'
        AND i."issuedAt" IS NOT NULL
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR p."paidAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR p."paidAt" <= ${filter.dateTo ?? null}::timestamptz)
        AND (
          ${caseIds}::uuid[] IS NULL
          OR i."caseId" = ANY(${caseIds}::uuid[])
        )
      GROUP BY i.id, i."issuedAt"
    )
    SELECT
      TO_CHAR(DATE_TRUNC('month', paid_at), 'YYYY-MM') AS month,
      COUNT(*)::text AS "paidInvoices",
      ROUND(AVG(EXTRACT(EPOCH FROM (paid_at - issued_at)) / 86400.0), 2)::text AS "avgCollectionDays"
    FROM paid_dates
    GROUP BY DATE_TRUNC('month', paid_at)
    ORDER BY month ASC
  `;
}

export async function queryInvoiceVoidTrendReport(
  tx: RepositoryTx,
  firmId: string,
  filter: { dateFrom?: string; dateTo?: string },
  options?: { caseIds?: string[] | null }
): Promise<Array<{ month: string; voidCount: string; voidAmount: string }>> {
  const caseIds = options?.caseIds ?? null;
  return tx.$queryRaw<Array<{ month: string; voidCount: string; voidAmount: string }>>`
    SELECT
      TO_CHAR(DATE_TRUNC('month', i."updatedAt"), 'YYYY-MM') AS month,
      COUNT(*)::text AS "voidCount",
      COALESCE(SUM(i."totalAmount"), 0)::text AS "voidAmount"
    FROM "Invoice" i
    WHERE i."firmId" = ${firmId}::uuid
      AND i.status = 'VOID'
      AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR i."updatedAt" >= ${filter.dateFrom ?? null}::timestamptz)
      AND (${filter.dateTo ?? null}::timestamptz IS NULL OR i."updatedAt" <= ${filter.dateTo ?? null}::timestamptz)
      AND (
        ${caseIds}::uuid[] IS NULL
        OR i."caseId" = ANY(${caseIds}::uuid[])
      )
    GROUP BY DATE_TRUNC('month', i."updatedAt")
    ORDER BY month ASC
  `;
}

export async function queryCashflowMonthlyReport(
  tx: RepositoryTx,
  firmId: string,
  filter: { dateFrom?: string; dateTo?: string },
  options?: { caseIds?: string[] | null }
): Promise<Array<{ month: string; cashIn: string; cashOut: string; netCash: string }>> {
  const caseIds = options?.caseIds ?? null;
  return tx.$queryRaw<Array<{ month: string; cashIn: string; cashOut: string; netCash: string }>>`
    WITH months AS (
      SELECT TO_CHAR(m, 'YYYY-MM') AS month
      FROM generate_series(
        DATE_TRUNC('month', COALESCE(${filter.dateFrom ?? null}::timestamptz, now() - interval '11 months')),
        DATE_TRUNC('month', COALESCE(${filter.dateTo ?? null}::timestamptz, now())),
        interval '1 month'
      ) m
    ),
    cash_in AS (
      SELECT
        TO_CHAR(DATE_TRUNC('month', p."paidAt"), 'YYYY-MM') AS month,
        COALESCE(SUM(p.amount), 0)::numeric(12,2) AS value
      FROM "Payment" p
      INNER JOIN "Invoice" i ON i.id = p."invoiceId"
      WHERE i."firmId" = ${firmId}::uuid
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR p."paidAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR p."paidAt" <= ${filter.dateTo ?? null}::timestamptz)
        AND (
          ${caseIds}::uuid[] IS NULL
          OR i."caseId" = ANY(${caseIds}::uuid[])
        )
      GROUP BY DATE_TRUNC('month', p."paidAt")
    ),
    cash_out AS (
      SELECT
        TO_CHAR(DATE_TRUNC('month', e."createdAt"), 'YYYY-MM') AS month,
        COALESCE(SUM(e.amount), 0)::numeric(12,2) AS value
      FROM "Expense" e
      WHERE e."firmId" = ${firmId}::uuid
        AND e."deletedAt" IS NULL
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR e."createdAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR e."createdAt" <= ${filter.dateTo ?? null}::timestamptz)
        AND (
          ${caseIds}::uuid[] IS NULL
          OR e."caseId" = ANY(${caseIds}::uuid[])
        )
      GROUP BY DATE_TRUNC('month', e."createdAt")
    )
    SELECT
      m.month,
      COALESCE(i.value, 0)::text AS "cashIn",
      COALESCE(o.value, 0)::text AS "cashOut",
      (COALESCE(i.value, 0) - COALESCE(o.value, 0))::text AS "netCash"
    FROM months m
    LEFT JOIN cash_in i ON i.month = m.month
    LEFT JOIN cash_out o ON o.month = m.month
    ORDER BY m.month ASC
  `;
}

export async function listOutstandingFirmInvoices(
  tx: RepositoryTx,
  firmId: string,
  now: Date
): Promise<Array<Prisma.InvoiceGetPayload<{ include: { client: { select: { name: true } } } }>>> {
  return tx.invoice.findMany({
    where: {
      firmId,
      status: { in: ["ISSUED", "PARTIALLY_PAID"] },
      dueDate: { lt: now }
    },
    include: { client: { select: { name: true } } },
    orderBy: { dueDate: "asc" }
  });
}

export async function findFirmCaseById(
  tx: RepositoryTx,
  firmId: string,
  caseId: string
): Promise<{ title: string } | null> {
  return tx.case.findFirst({
    where: { id: caseId, firmId },
    select: { title: true }
  });
}

export async function listCaseInvoicesWithPayments(
  tx: RepositoryTx,
  firmId: string,
  caseId: string
) {
  return tx.invoice.findMany({
    where: { firmId, caseId, status: { not: "VOID" } },
    include: { payments: true }
  });
}

export async function listCaseExpenses(
  tx: RepositoryTx,
  firmId: string,
  caseId: string
) {
  return tx.expense.findMany({
    where: { firmId, caseId }
  });
}

export async function listFirmCaseSessionsForLitigationSheet(
  tx: RepositoryTx,
  firmId: string
): Promise<
  Array<{
    caseId: string;
    caseNumber: string;
    caseTitle: string;
    clientName: string;
    sessionDatetime: Date;
    outcome: string | null;
    notes: string | null;
  }>
> {
  const sessions = await tx.caseSession.findMany({
    where: {
      deletedAt: null,
      case: {
        firmId,
        deletedAt: null
      }
    },
    include: {
      case: {
        select: {
          id: true,
          caseNumber: true,
          title: true,
          client: {
            select: {
              name: true
            }
          }
        }
      }
    },
    orderBy: [{ sessionDatetime: "asc" }, { createdAt: "asc" }]
  });

  return sessions.map((session) => ({
    caseId: session.case.id,
    caseNumber: session.case.caseNumber,
    caseTitle: session.case.title,
    clientName: session.case.client.name,
    sessionDatetime: session.sessionDatetime,
    outcome: session.outcome,
    notes: session.notes
  }));
}
