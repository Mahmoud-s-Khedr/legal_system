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
  filter: { dateFrom?: string; dateTo?: string }
): Promise<Array<{ month: string; invoiced: string; paid: string }>> {
  return tx.$queryRaw<Array<{ month: string; invoiced: string; paid: string }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
        SUM("totalAmount")::text AS invoiced,
        SUM(CASE WHEN status IN ('PAID','PARTIALLY_PAID')
          THEN (SELECT COALESCE(SUM(amount), 0) FROM "Payment" p WHERE p."invoiceId" = "Invoice".id)
          ELSE 0 END)::text AS paid
      FROM "Invoice"
      WHERE "firmId" = ${firmId}::uuid
        AND status != 'VOID'
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR "createdAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR "createdAt" <= ${filter.dateTo ?? null}::timestamptz)
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
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
