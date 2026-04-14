import type {
  CaseProfitabilityDto,
  CaseStatusRow,
  HearingOutcomeRow,
  LawyerWorkloadRow,
  OutstandingBalanceRow,
  RevenueReportRow,
  SessionUser
} from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";

export interface ReportFilter {
  dateFrom?: string;
  dateTo?: string;
  caseId?: string;
  userId?: string;
}

export async function caseStatusDistribution(
  actor: SessionUser,
  filter: ReportFilter
): Promise<CaseStatusRow[]> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const rows = await tx.$queryRaw<Array<{ status: string; count: bigint }>>`
      SELECT status, COUNT(*) AS count
      FROM "Case"
      WHERE "firmId" = ${actor.firmId}::uuid
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR "createdAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR "createdAt" <= ${filter.dateTo ?? null}::timestamptz)
      GROUP BY status
      ORDER BY count DESC
    `;
    return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  });
}

export async function hearingOutcomes(
  actor: SessionUser,
  filter: ReportFilter
): Promise<HearingOutcomeRow[]> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const rows = await tx.$queryRaw<Array<{ outcome: string | null; count: bigint }>>`
      SELECT outcome, COUNT(*) AS count
      FROM "CaseSession"
      WHERE (${filter.dateFrom ?? null}::timestamptz IS NULL OR "sessionDatetime" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR "sessionDatetime" <= ${filter.dateTo ?? null}::timestamptz)
        AND EXISTS (
          SELECT 1
          FROM "Case" c
          WHERE c.id = "CaseSession"."caseId"
            AND c."firmId" = ${actor.firmId}::uuid
        )
      GROUP BY outcome
      ORDER BY count DESC
    `;
    return rows.map((r) => ({ outcome: r.outcome, count: Number(r.count) }));
  });
}

export async function lawyerWorkload(actor: SessionUser): Promise<LawyerWorkloadRow[]> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const users = await tx.user.findMany({
      where: { firmId: actor.firmId, status: "ACTIVE" },
      select: { id: true, fullName: true }
    });

    const now = new Date();

    const results: LawyerWorkloadRow[] = await Promise.all(
      users.map(async (u) => {
        const [openCases, openTasks, upcomingHearings] = await Promise.all([
          tx.caseAssignment.count({
            where: {
              userId: u.id,
              unassignedAt: null,
              assignedCase: { firmId: actor.firmId, status: "ACTIVE", deletedAt: null }
            }
          }),
          tx.task.count({
            where: {
              firmId: actor.firmId,
              assignedToId: u.id,
              status: { notIn: ["DONE", "CANCELLED"] }
            }
          }),
          tx.caseSession.count({
            where: {
              case: { firmId: actor.firmId, deletedAt: null },
              assignedLawyerId: u.id,
              sessionDatetime: { gte: now }
            }
          })
        ]);

        return {
          userId: u.id,
          fullName: u.fullName,
          openCases,
          openTasks,
          upcomingHearings
        };
      })
    );

    return results.sort((a, b) => b.openCases - a.openCases);
  });
}

export async function revenueReport(
  actor: SessionUser,
  filter: ReportFilter
): Promise<RevenueReportRow[]> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const rows = await tx.$queryRaw<Array<{ month: string; invoiced: string; paid: string }>>`
      SELECT
        TO_CHAR(DATE_TRUNC('month', "createdAt"), 'YYYY-MM') AS month,
        SUM("totalAmount")::text AS invoiced,
        SUM(CASE WHEN status IN ('PAID','PARTIALLY_PAID')
          THEN (SELECT COALESCE(SUM(amount), 0) FROM "Payment" p WHERE p."invoiceId" = "Invoice".id)
          ELSE 0 END)::text AS paid
      FROM "Invoice"
      WHERE "firmId" = ${actor.firmId}::uuid
        AND status != 'VOID'
        AND (${filter.dateFrom ?? null}::timestamptz IS NULL OR "createdAt" >= ${filter.dateFrom ?? null}::timestamptz)
        AND (${filter.dateTo ?? null}::timestamptz IS NULL OR "createdAt" <= ${filter.dateTo ?? null}::timestamptz)
      GROUP BY DATE_TRUNC('month', "createdAt")
      ORDER BY month ASC
    `;
    return rows;
  });
}

export async function outstandingBalances(actor: SessionUser): Promise<OutstandingBalanceRow[]> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const now = new Date();
    const invoices = await tx.invoice.findMany({
      where: {
        firmId: actor.firmId,
        status: { in: ["ISSUED", "PARTIALLY_PAID"] },
        dueDate: { lt: now }
      },
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: "asc" }
    });

    return invoices.map((inv) => {
      const daysOverdue = inv.dueDate
        ? Math.floor((now.getTime() - inv.dueDate.getTime()) / 86_400_000)
        : 0;

      return {
        invoiceId: inv.id,
        invoiceNumber: inv.invoiceNumber,
        clientName: inv.client?.name ?? null,
        totalAmount: inv.totalAmount.toString(),
        dueDate: inv.dueDate?.toISOString() ?? null,
        daysOverdue
      };
    });
  });
}

export async function caseProfitability(
  actor: SessionUser,
  caseId: string
): Promise<CaseProfitabilityDto | null> {
  return withTenant(prisma, actor.firmId, async (tx) => {
    const caseRow = await tx.case.findFirst({
      where: { id: caseId, firmId: actor.firmId }
    });

    if (!caseRow) {
      return null;
    }

    const invoices = await tx.invoice.findMany({
      where: { firmId: actor.firmId, caseId, status: { not: "VOID" } },
      include: { payments: true }
    });

    const expenses = await tx.expense.findMany({
      where: { firmId: actor.firmId, caseId }
    });

    const totalBilled = invoices.reduce((s, inv) => s + Number(inv.totalAmount), 0);
    const totalPaid = invoices.reduce(
      (s, inv) => s + inv.payments.reduce((ps, p) => ps + Number(p.amount), 0),
      0
    );
    const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);
    const grossProfit = totalPaid - totalExpenses;

    return {
      caseId,
      caseTitle: caseRow.title,
      totalBilled: totalBilled.toFixed(2),
      totalPaid: totalPaid.toFixed(2),
      totalExpenses: totalExpenses.toFixed(2),
      grossProfit: grossProfit.toFixed(2)
    };
  });
}
