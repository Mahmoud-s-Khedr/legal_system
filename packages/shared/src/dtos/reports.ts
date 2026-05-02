export type ReportType =
  | "case-status"
  | "hearing-outcomes"
  | "lawyer-workload"
  | "revenue"
  | "outstanding-balances"
  | "earnings-losses"
  | "dso-collection-lag"
  | "invoice-void-trend"
  | "cashflow-monthly"
  | "ar-aging";

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

export interface EarningsLossesRow {
  month: string;
  cashEarnings: string;
  accrualEarnings: string;
  operatingExpenses: string;
  invoiceLosses: string;
  totalLosses: string;
  netProfitCash: string;
  netProfitAccrual: string;
}

export interface DsoCollectionLagRow {
  month: string;
  paidInvoices: string;
  avgCollectionDays: string;
}

export interface InvoiceVoidTrendRow {
  month: string;
  voidCount: string;
  voidAmount: string;
}

export interface CashflowMonthlyRow {
  month: string;
  cashIn: string;
  cashOut: string;
  netCash: string;
}

export interface ArAgingRow {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string | null;
  caseTitle: string | null;
  balanceDue: string;
  dueDate: string | null;
  daysOverdue: number;
  agingBucket: "CURRENT" | "1_30" | "31_60" | "61_90" | "90_PLUS";
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
  "earnings-losses": EarningsLossesRow;
  "dso-collection-lag": DsoCollectionLagRow;
  "invoice-void-trend": InvoiceVoidTrendRow;
  "cashflow-monthly": CashflowMonthlyRow;
  "ar-aging": ArAgingRow;
}

export type ReportRowForType<T extends ReportType> = ReportRowByTypeMap[T];

export interface ReportListResponseDto<TItem> {
  items: TItem[];
  total: number;
  page: number;
  pageSize: number;
}

export type ReportListResponseByType<T extends ReportType> = ReportListResponseDto<ReportRowForType<T>>;
