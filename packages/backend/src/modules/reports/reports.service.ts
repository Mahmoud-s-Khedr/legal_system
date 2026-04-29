import type {
  CaseProfitabilityDto,
  CaseStatusRow,
  HearingOutcomeRow,
  LawyerWorkloadRow,
  OutstandingBalanceRow,
  RevenueReportRow,
  SessionUser
} from "@elms/shared";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  countOpenAssignedCases,
  countOpenAssignedTasks,
  countUpcomingAssignedHearings,
  findFirmCaseById,
  listActiveFirmUsers,
  listFirmCaseSessionsForLitigationSheet,
  listCaseExpenses,
  listCaseInvoicesWithPayments,
  listOutstandingFirmInvoices,
  queryCaseStatusDistribution,
  queryHearingOutcomes,
  queryRevenueReport
} from "../../repositories/reports/reports.repository.js";

export interface ReportFilter {
  dateFrom?: string;
  dateTo?: string;
  caseId?: string;
  userId?: string;
}

export interface LitigationSheetRow {
  clientName: string;
  caseNumber: string;
  caseSubject: string;
  previousSessionDate: string;
  upcomingSessionDate: string;
  decision: string;
  notes: string;
}

export async function caseStatusDistribution(
  actor: SessionUser,
  filter: ReportFilter
): Promise<CaseStatusRow[]> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const rows = await queryCaseStatusDistribution(tx, actor.firmId, filter);
    return rows.map((r) => ({ status: r.status, count: Number(r.count) }));
  });
}

export async function hearingOutcomes(
  actor: SessionUser,
  filter: ReportFilter
): Promise<HearingOutcomeRow[]> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const rows = await queryHearingOutcomes(tx, actor.firmId, filter);
    return rows.map((r) => ({ outcome: r.outcome, count: Number(r.count) }));
  });
}

export async function lawyerWorkload(actor: SessionUser): Promise<LawyerWorkloadRow[]> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const users = await listActiveFirmUsers(tx, actor.firmId);

    const now = new Date();

    const results: LawyerWorkloadRow[] = await Promise.all(
      users.map(async (u) => {
        const [openCases, openTasks, upcomingHearings] = await Promise.all([
          countOpenAssignedCases(tx, actor.firmId, u.id),
          countOpenAssignedTasks(tx, actor.firmId, u.id),
          countUpcomingAssignedHearings(tx, actor.firmId, u.id, now)
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
  return inTenantTransaction(actor.firmId, async (tx) => {
    return queryRevenueReport(tx, actor.firmId, filter);
  });
}

export async function outstandingBalances(actor: SessionUser): Promise<OutstandingBalanceRow[]> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const now = new Date();
    const invoices = await listOutstandingFirmInvoices(tx, actor.firmId, now);

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
  return inTenantTransaction(actor.firmId, async (tx) => {
    const caseRow = await findFirmCaseById(tx, actor.firmId, caseId);

    if (!caseRow) {
      return null;
    }

    const [invoices, expenses] = await Promise.all([
      listCaseInvoicesWithPayments(tx, actor.firmId, caseId),
      listCaseExpenses(tx, actor.firmId, caseId)
    ]);

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

export async function litigationSheetRows(actor: SessionUser): Promise<LitigationSheetRow[]> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const rawRows = await listFirmCaseSessionsForLitigationSheet(tx, actor.firmId);
    const now = new Date();
    const rowsByCase = new Map<string, typeof rawRows>();

    for (const row of rawRows) {
      const group = rowsByCase.get(row.caseId);
      if (group) {
        group.push(row);
      } else {
        rowsByCase.set(row.caseId, [row]);
      }
    }

    const reportRows: Array<LitigationSheetRow & { sortDate: string }> = [];
    for (const sessions of rowsByCase.values()) {
      sessions.sort((a, b) => a.sessionDatetime.getTime() - b.sessionDatetime.getTime());

      const previous = [...sessions]
        .reverse()
        .find((session) => session.sessionDatetime.getTime() < now.getTime());
      const upcoming = sessions.find((session) => session.sessionDatetime.getTime() >= now.getTime());
      const latest = sessions[sessions.length - 1];

      const previousSessionDate = previous ? previous.sessionDatetime.toISOString().slice(0, 10) : "";
      const upcomingSessionDate = upcoming ? upcoming.sessionDatetime.toISOString().slice(0, 10) : "";
      const decision = previous?.outcome ?? "";
      const notes = latest?.notes ?? "";

      for (const session of sessions) {
        reportRows.push({
          clientName: session.clientName,
          caseNumber: session.caseNumber,
          caseSubject: session.caseTitle,
          previousSessionDate,
          upcomingSessionDate,
          decision,
          notes,
          sortDate: upcomingSessionDate || session.sessionDatetime.toISOString().slice(0, 10)
        });
      }
    }

    reportRows.sort((a, b) => {
      if (a.sortDate === b.sortDate) {
        return a.caseNumber.localeCompare(b.caseNumber, undefined, { sensitivity: "base", numeric: true });
      }
      if (!a.sortDate) return 1;
      if (!b.sortDate) return -1;
      return a.sortDate.localeCompare(b.sortDate);
    });

    return reportRows.map(({ sortDate, ...row }) => {
      void sortDate;
      return row;
    });
  });
}
