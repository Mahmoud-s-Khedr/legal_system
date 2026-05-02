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
  ReportType,
  RevenueReportRow
} from "../../lib/reports";

export type ReportGraphSeriesKey =
  | "count"
  | "invoiced"
  | "paid"
  | "openCases"
  | "openTasks"
  | "upcomingHearings"
  | "totalAmount"
  | "daysOverdue"
  | "cashEarnings"
  | "accrualEarnings"
  | "totalLosses"
  | "netProfitCash"
  | "avgCollectionDays"
  | "paidInvoices"
  | "voidCount"
  | "voidAmount"
  | "cashIn"
  | "cashOut"
  | "netCash"
  | "balanceDue";

export interface ReportGraphDatum {
  label: string;
  [key: string]: string | number;
}

export interface ReportGraphSpec {
  chart: "bar" | "line" | "area" | "combo";
  xKey: "label";
  data: ReportGraphDatum[];
  series: Array<{ key: ReportGraphSeriesKey; labelKey: string; color: string }>;
  valueFormat: "number" | "currency" | "days";
}

function toNumber(value: string | number) {
  return typeof value === "number" ? value : Number(value);
}

function bucketDays(days: number): string {
  if (days <= 0) return "CURRENT";
  if (days <= 30) return "1_30";
  if (days <= 60) return "31_60";
  if (days <= 90) return "61_90";
  return "90_PLUS";
}

function translateAgingBucket(bucket: string): string {
  const map: Record<string, string> = {
    CURRENT: "Current",
    "1_30": "1-30",
    "31_60": "31-60",
    "61_90": "61-90",
    "90_PLUS": "90+"
  };
  return map[bucket] ?? bucket;
}

export function buildReportGraphData(
  reportType: ReportType,
  rows: Array<
    | CaseStatusRow
    | HearingOutcomeRow
    | LawyerWorkloadRow
    | RevenueReportRow
    | OutstandingBalanceRow
    | EarningsLossesRow
    | DsoCollectionLagRow
    | InvoiceVoidTrendRow
    | CashflowMonthlyRow
    | ArAgingRow
  >
): ReportGraphSpec {
  switch (reportType) {
    case "case-status": {
      const data = (rows as CaseStatusRow[]).map((row) => ({ label: row.status, count: row.count }));
      return {
        chart: "bar",
        xKey: "label",
        data,
        series: [{ key: "count", labelKey: "reports.count", color: "#0f766e" }],
        valueFormat: "number"
      };
    }
    case "hearing-outcomes": {
      const data = (rows as HearingOutcomeRow[]).map((row) => ({ label: row.outcome ?? "—", count: row.count }));
      return {
        chart: "bar",
        xKey: "label",
        data,
        series: [{ key: "count", labelKey: "reports.count", color: "#2563eb" }],
        valueFormat: "number"
      };
    }
    case "lawyer-workload": {
      const data = (rows as LawyerWorkloadRow[]).map((row) => ({
        label: row.fullName,
        openCases: row.openCases,
        openTasks: row.openTasks,
        upcomingHearings: row.upcomingHearings
      }));
      return {
        chart: "bar",
        xKey: "label",
        data,
        series: [
          { key: "openCases", labelKey: "reports.openCases", color: "#0f766e" },
          { key: "openTasks", labelKey: "reports.openTasks", color: "#f59e0b" },
          { key: "upcomingHearings", labelKey: "reports.upcomingHearings", color: "#7c3aed" }
        ],
        valueFormat: "number"
      };
    }
    case "revenue": {
      const data = (rows as RevenueReportRow[]).map((row) => ({
        label: row.month,
        invoiced: toNumber(row.invoiced),
        paid: toNumber(row.paid)
      }));
      return {
        chart: "line",
        xKey: "label",
        data,
        series: [
          { key: "invoiced", labelKey: "billing.totalBilled", color: "#f59e0b" },
          { key: "paid", labelKey: "billing.totalPaid", color: "#059669" }
        ],
        valueFormat: "currency"
      };
    }
    case "outstanding-balances": {
      const agg = new Map<string, { count: number; totalAmount: number }>();
      for (const row of rows as OutstandingBalanceRow[]) {
        const bucket = bucketDays(row.daysOverdue);
        const prev = agg.get(bucket) ?? { count: 0, totalAmount: 0 };
        agg.set(bucket, { count: prev.count + 1, totalAmount: prev.totalAmount + toNumber(row.totalAmount) });
      }
      const order = ["CURRENT", "1_30", "31_60", "61_90", "90_PLUS"];
      const data = order.map((bucket) => ({
        label: translateAgingBucket(bucket),
        count: agg.get(bucket)?.count ?? 0,
        totalAmount: agg.get(bucket)?.totalAmount ?? 0
      }));
      return {
        chart: "bar",
        xKey: "label",
        data,
        series: [
          { key: "count", labelKey: "reports.count", color: "#dc2626" },
          { key: "totalAmount", labelKey: "billing.total", color: "#7f1d1d" }
        ],
        valueFormat: "currency"
      };
    }
    case "earnings-losses": {
      const data = (rows as EarningsLossesRow[]).map((row) => ({
        label: row.month,
        cashEarnings: toNumber(row.cashEarnings),
        accrualEarnings: toNumber(row.accrualEarnings),
        totalLosses: toNumber(row.totalLosses),
        netProfitCash: toNumber(row.netProfitCash)
      }));
      return {
        chart: "combo",
        xKey: "label",
        data,
        series: [
          { key: "cashEarnings", labelKey: "reports.cashEarnings", color: "#0f766e" },
          { key: "accrualEarnings", labelKey: "reports.accrualEarnings", color: "#0369a1" },
          { key: "totalLosses", labelKey: "reports.totalLosses", color: "#dc2626" },
          { key: "netProfitCash", labelKey: "reports.netProfitCash", color: "#7c3aed" }
        ],
        valueFormat: "currency"
      };
    }
    case "dso-collection-lag": {
      const data = (rows as DsoCollectionLagRow[]).map((row) => ({
        label: row.month,
        avgCollectionDays: toNumber(row.avgCollectionDays),
        paidInvoices: toNumber(row.paidInvoices)
      }));
      return {
        chart: "line",
        xKey: "label",
        data,
        series: [
          { key: "avgCollectionDays", labelKey: "reports.avgCollectionDays", color: "#2563eb" },
          { key: "paidInvoices", labelKey: "reports.paidInvoices", color: "#14b8a6" }
        ],
        valueFormat: "days"
      };
    }
    case "invoice-void-trend": {
      const data = (rows as InvoiceVoidTrendRow[]).map((row) => ({
        label: row.month,
        voidCount: toNumber(row.voidCount),
        voidAmount: toNumber(row.voidAmount)
      }));
      return {
        chart: "bar",
        xKey: "label",
        data,
        series: [
          { key: "voidCount", labelKey: "reports.voidCount", color: "#ea580c" },
          { key: "voidAmount", labelKey: "reports.voidAmount", color: "#991b1b" }
        ],
        valueFormat: "currency"
      };
    }
    case "cashflow-monthly": {
      const data = (rows as CashflowMonthlyRow[]).map((row) => ({
        label: row.month,
        cashIn: toNumber(row.cashIn),
        cashOut: toNumber(row.cashOut),
        netCash: toNumber(row.netCash)
      }));
      return {
        chart: "area",
        xKey: "label",
        data,
        series: [
          { key: "cashIn", labelKey: "reports.cashIn", color: "#059669" },
          { key: "cashOut", labelKey: "reports.cashOut", color: "#dc2626" },
          { key: "netCash", labelKey: "reports.netCash", color: "#4f46e5" }
        ],
        valueFormat: "currency"
      };
    }
    case "ar-aging": {
      const agg = new Map<string, { count: number; balanceDue: number }>();
      for (const row of rows as ArAgingRow[]) {
        const prev = agg.get(row.agingBucket) ?? { count: 0, balanceDue: 0 };
        agg.set(row.agingBucket, { count: prev.count + 1, balanceDue: prev.balanceDue + toNumber(row.balanceDue) });
      }
      const order = ["CURRENT", "1_30", "31_60", "61_90", "90_PLUS"];
      const data = order.map((bucket) => ({
        label: translateAgingBucket(bucket),
        count: agg.get(bucket)?.count ?? 0,
        balanceDue: agg.get(bucket)?.balanceDue ?? 0
      }));
      return {
        chart: "bar",
        xKey: "label",
        data,
        series: [
          { key: "count", labelKey: "reports.count", color: "#475569" },
          { key: "balanceDue", labelKey: "reports.balanceDue", color: "#dc2626" }
        ],
        valueFormat: "currency"
      };
    }
    default: {
      return {
        chart: "bar",
        xKey: "label",
        data: [],
        series: [{ key: "count", labelKey: "reports.count", color: "#0f766e" }],
        valueFormat: "number"
      };
    }
  }
}
