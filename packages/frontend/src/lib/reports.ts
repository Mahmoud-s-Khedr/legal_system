export interface CaseStatusRow {
  status: string;
  count: number;
}

export interface HearingOutcomeRow {
  outcome: string | null;
  count: number;
}

export interface LawyerWorkloadRow {
  userId: string;
  fullName: string;
  openCases: number;
  openTasks: number;
  upcomingHearings: number;
}

export interface RevenueReportRow {
  month: string;
  invoiced: string;
  paid: string;
}

export interface OutstandingBalanceRow {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string | null;
  totalAmount: string;
  dueDate: string | null;
  daysOverdue: number;
}

export interface CaseProfitabilityDto {
  caseId: string;
  caseTitle: string;
  totalBilled: string;
  totalPaid: string;
  totalExpenses: string;
  grossProfit: string;
}
