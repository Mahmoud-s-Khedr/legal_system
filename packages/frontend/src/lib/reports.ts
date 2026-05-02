import type {
  ArAgingRow,
  CashflowMonthlyRow,
  CaseStatusRow,
  DsoCollectionLagRow,
  EarningsLossesRow,
  HearingOutcomeRow,
  InvoiceVoidTrendRow,
  LawyerWorkloadRow,
  OutstandingBalanceRow,
  ReportListResponseByType,
  ReportRowByTypeMap,
  ReportType,
  RevenueReportRow
} from "@elms/shared";

export type {
  ArAgingRow,
  CashflowMonthlyRow,
  CaseStatusRow,
  DsoCollectionLagRow,
  EarningsLossesRow,
  HearingOutcomeRow,
  InvoiceVoidTrendRow,
  LawyerWorkloadRow,
  OutstandingBalanceRow,
  ReportListResponseByType,
  ReportType,
  RevenueReportRow
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function validateBaseReportListResponse(value: unknown): value is {
  items: unknown[];
  total: number;
  page: number;
  pageSize: number;
} {
  if (!isObject(value)) {
    return false;
  }

  return (
    Array.isArray(value.items) &&
    isNumber(value.total) &&
    isNumber(value.page) &&
    isNumber(value.pageSize)
  );
}

function isCaseStatusRow(value: unknown): value is CaseStatusRow {
  return isObject(value) && isString(value.status) && isNumber(value.count);
}

function isHearingOutcomeRow(value: unknown): value is HearingOutcomeRow {
  return isObject(value) && (value.outcome === null || isString(value.outcome)) && isNumber(value.count);
}

function isLawyerWorkloadRow(value: unknown): value is LawyerWorkloadRow {
  return (
    isObject(value) &&
    isString(value.userId) &&
    isString(value.fullName) &&
    isNumber(value.openCases) &&
    isNumber(value.openTasks) &&
    isNumber(value.upcomingHearings)
  );
}

function isRevenueReportRow(value: unknown): value is RevenueReportRow {
  return (
    isObject(value) &&
    isString(value.month) &&
    isString(value.invoiced) &&
    isString(value.paid)
  );
}

function isOutstandingBalanceRow(value: unknown): value is OutstandingBalanceRow {
  return (
    isObject(value) &&
    isString(value.invoiceId) &&
    isString(value.invoiceNumber) &&
    (value.clientName === null || isString(value.clientName)) &&
    isString(value.totalAmount) &&
    (value.dueDate === null || isString(value.dueDate)) &&
    isNumber(value.daysOverdue)
  );
}

function isEarningsLossesRow(value: unknown): value is EarningsLossesRow {
  return (
    isObject(value) &&
    isString(value.month) &&
    isString(value.cashEarnings) &&
    isString(value.accrualEarnings) &&
    isString(value.operatingExpenses) &&
    isString(value.invoiceLosses) &&
    isString(value.totalLosses) &&
    isString(value.netProfitCash) &&
    isString(value.netProfitAccrual)
  );
}

function isDsoCollectionLagRow(value: unknown): value is DsoCollectionLagRow {
  return isObject(value) && isString(value.month) && isString(value.paidInvoices) && isString(value.avgCollectionDays);
}

function isInvoiceVoidTrendRow(value: unknown): value is InvoiceVoidTrendRow {
  return isObject(value) && isString(value.month) && isString(value.voidCount) && isString(value.voidAmount);
}

function isCashflowMonthlyRow(value: unknown): value is CashflowMonthlyRow {
  return isObject(value) && isString(value.month) && isString(value.cashIn) && isString(value.cashOut) && isString(value.netCash);
}

function isArAgingRow(value: unknown): value is ArAgingRow {
  return (
    isObject(value) &&
    isString(value.invoiceId) &&
    isString(value.invoiceNumber) &&
    (value.clientName === null || isString(value.clientName)) &&
    (value.caseTitle === null || isString(value.caseTitle)) &&
    isString(value.balanceDue) &&
    (value.dueDate === null || isString(value.dueDate)) &&
    isNumber(value.daysOverdue) &&
    isString(value.agingBucket)
  );
}

const rowValidators: { [K in ReportType]: (value: unknown) => value is ReportRowByTypeMap[K] } = {
  "case-status": isCaseStatusRow,
  "hearing-outcomes": isHearingOutcomeRow,
  "lawyer-workload": isLawyerWorkloadRow,
  revenue: isRevenueReportRow,
  "outstanding-balances": isOutstandingBalanceRow,
  "earnings-losses": isEarningsLossesRow,
  "dso-collection-lag": isDsoCollectionLagRow,
  "invoice-void-trend": isInvoiceVoidTrendRow,
  "cashflow-monthly": isCashflowMonthlyRow,
  "ar-aging": isArAgingRow
};

export function parseReportListResponse<T extends ReportType>(
  reportType: T,
  payload: unknown
): ReportListResponseByType<T> {
  if (!validateBaseReportListResponse(payload)) {
    throw new Error("Invalid report response shape.");
  }

  const validator = rowValidators[reportType] as (value: unknown) => value is ReportRowByTypeMap[T];
  if (!payload.items.every((row) => validator(row))) {
    throw new Error("Invalid report row schema.");
  }

  return {
    items: payload.items,
    total: payload.total,
    page: payload.page,
    pageSize: payload.pageSize
  };
}
