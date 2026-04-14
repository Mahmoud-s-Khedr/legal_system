export type ReportType =
  | "case-status"
  | "hearing-outcomes"
  | "lawyer-workload"
  | "revenue"
  | "outstanding-balances";

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

export interface ReportRowByTypeMap {
  "case-status": CaseStatusRow;
  "hearing-outcomes": HearingOutcomeRow;
  "lawyer-workload": LawyerWorkloadRow;
  revenue: RevenueReportRow;
  "outstanding-balances": OutstandingBalanceRow;
}

export type ReportRowForType<T extends ReportType> = ReportRowByTypeMap[T];

export interface ReportListResponseDto<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type ReportListResponseByType<T extends ReportType> = ReportListResponseDto<ReportRowForType<T>>;
