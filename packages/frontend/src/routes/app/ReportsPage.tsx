import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToastStore } from "../../store/toastStore";
import { apiFetch } from "../../lib/api";
import { formatFileSaveSuccessMessage } from "../../lib/fileSaveFeedback";
import { useLocalizedLookupOptions } from "../../lib/lookups";
import { useTableQueryState } from "../../lib/tableQueryState";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import {
  EmptyState,
  ErrorState,
  Field,
  FormAlert,
  PageHeader,
  SectionCard,
  SelectField,
  TablePagination,
  TableToolbar,
  formatCurrency
} from "./ui";
import { downloadReportFile } from "./reportExport";
import { buildReportGraphData, type ReportGraphSpec } from "./reportGraph";
import { exportReportGraphAsPdf, exportReportGraphAsPng } from "./reportGraphExport";
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
  ReportListResponseByType,
  RevenueReportRow
} from "../../lib/reports";
import { parseReportListResponse } from "../../lib/reports";
import { forwardRef } from "react";

type ReportViewMode = "table" | "graph";

export function buildReportOptions(
  t: (key: string) => string
): Array<{ value: ReportType; label: string }> {
  return [
    { value: "case-status", label: t("reports.caseStatus") },
    { value: "hearing-outcomes", label: t("reports.hearingOutcomes") },
    { value: "lawyer-workload", label: t("reports.lawyerWorkload") },
    { value: "revenue", label: t("reports.revenue") },
    { value: "outstanding-balances", label: t("reports.outstandingBalances") },
    { value: "earnings-losses", label: t("reports.earningsLosses") },
    { value: "dso-collection-lag", label: t("reports.dsoCollectionLag") },
    { value: "invoice-void-trend", label: t("reports.invoiceVoidTrend") },
    { value: "cashflow-monthly", label: t("reports.cashflowMonthly") },
    { value: "ar-aging", label: t("reports.arAging") }
  ];
}

export function buildReportSortOptions(
  t: (key: string) => string
): Record<ReportType, Array<{ value: string; label: string }>> {
  return {
    "case-status": [
      { value: "count:desc", label: `${t("reports.count")} ↓` },
      { value: "count:asc", label: `${t("reports.count")} ↑` },
      { value: "status:asc", label: `${t("labels.status")} A-Z` }
    ],
    "hearing-outcomes": [
      { value: "count:desc", label: `${t("reports.count")} ↓` },
      { value: "count:asc", label: `${t("reports.count")} ↑` },
      { value: "outcome:asc", label: `${t("labels.outcome")} A-Z` }
    ],
    "lawyer-workload": [
      { value: "openCases:desc", label: `${t("reports.openCases")} ↓` },
      { value: "openTasks:desc", label: `${t("reports.openTasks")} ↓` },
      { value: "fullName:asc", label: `${t("labels.user")} A-Z` }
    ],
    revenue: [
      { value: "month:asc", label: `${t("reports.month")} ↑` },
      { value: "month:desc", label: `${t("reports.month")} ↓` },
      { value: "invoiced:desc", label: `${t("billing.totalBilled")} ↓` }
    ],
    "outstanding-balances": [
      { value: "daysOverdue:desc", label: `${t("reports.daysOverdue")} ↓` },
      { value: "totalAmount:desc", label: `${t("billing.total")} ↓` },
      { value: "invoiceNumber:asc", label: `${t("billing.invoiceNumber")} A-Z` }
    ],
    "earnings-losses": [
      { value: "month:asc", label: `${t("reports.month")} ↑` },
      { value: "month:desc", label: `${t("reports.month")} ↓` },
      { value: "netProfitCash:desc", label: `${t("reports.netProfitCash")} ↓` }
    ],
    "dso-collection-lag": [
      { value: "month:asc", label: `${t("reports.month")} ↑` },
      { value: "avgCollectionDays:desc", label: `${t("reports.avgCollectionDays")} ↓` }
    ],
    "invoice-void-trend": [
      { value: "month:asc", label: `${t("reports.month")} ↑` },
      { value: "voidAmount:desc", label: `${t("reports.voidAmount")} ↓` }
    ],
    "cashflow-monthly": [
      { value: "month:asc", label: `${t("reports.month")} ↑` },
      { value: "netCash:desc", label: `${t("reports.netCash")} ↓` }
    ],
    "ar-aging": [
      { value: "daysOverdue:desc", label: `${t("reports.daysOverdue")} ↓` },
      { value: "balanceDue:desc", label: `${t("reports.balanceDue")} ↓` }
    ]
  };
}

export function pickReportSort(
  reportType: ReportType,
  sortOptions: Record<ReportType, Array<{ value: string; label: string }>>
) {
  return sortOptions[reportType][0]?.value ?? "count:desc";
}

export function buildReportExportMeta(
  reportType: ReportType,
  format: "excel" | "pdf",
  baseQuery: URLSearchParams
) {
  const query = new URLSearchParams(baseQuery);
  query.set("format", format);
  const extension = format === "pdf" ? "pdf" : "xlsx";
  return {
    requestPath: `/api/reports/${reportType}/export?${query.toString()}`,
    fallbackFilename: `report-${reportType}.${extension}`
  };
}

export function buildLitigationSheetExportMeta() {
  return {
    requestPath: "/api/reports/litigation-sheet/export",
    fallbackFilename: "litigation-sheet.xlsx"
  };
}

export function ReportsPage() {
  const { t } = useTranslation("app");
  const addToast = useToastStore((state) => state.addToast);
  const [reportType, setReportType] = useState<ReportType>("case-status");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ReportViewMode>("table");
  const graphContainerRef = useRef<HTMLDivElement | null>(null);
  const table = useTableQueryState({
    defaultSortBy: "count",
    defaultSortDir: "desc",
    defaultLimit: 20
  });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["reports", reportType, dateFrom, dateTo, table.state],
    queryFn: async (): Promise<ReportListResponseByType<ReportType>> => {
      const payload = await apiFetch<unknown>(
        `/api/reports/${reportType}?${table.toApiQueryString({ dateFrom, dateTo })}`
      );
      return parseReportListResponse(reportType, payload);
    }
  });

  const reportOptions = buildReportOptions(t);
  const sortOptions = buildReportSortOptions(t);
  const graphSpec = useMemo(() => {
    if (!data?.items?.length) return null;
    return buildReportGraphData(reportType, data.items);
  }, [data?.items, reportType]);

  async function exportReport(format: "excel" | "pdf") {
    setExportError(null);
    const exportMeta = buildReportExportMeta(
      reportType,
      format,
      new URLSearchParams(table.toApiQueryString({ dateFrom, dateTo }))
    );

    try {
      const savedPath = await downloadReportFile(
        exportMeta.requestPath,
        exportMeta.fallbackFilename
      );
      addToast(formatFileSaveSuccessMessage(t, savedPath), "success");
    } catch (error) {
      const message = (error as Error)?.message ?? t("errors.fallback");
      setExportError(message);
      addToast(message, "error");
    }
  }

  async function exportLitigationSheet() {
    setExportError(null);
    const exportMeta = buildLitigationSheetExportMeta();
    try {
      const savedPath = await downloadReportFile(
        exportMeta.requestPath,
        exportMeta.fallbackFilename
      );
      addToast(formatFileSaveSuccessMessage(t, savedPath), "success");
    } catch (error) {
      const message = (error as Error)?.message ?? t("errors.fallback");
      setExportError(message);
      addToast(message, "error");
    }
  }

  async function exportGraph(format: "png" | "pdf") {
    setExportError(null);
    const container = graphContainerRef.current;
    if (!container) {
      const message = t("reports.graphUnavailable");
      setExportError(message);
      addToast(message, "error");
      return;
    }
    const baseName = `report-${reportType}-graph`;
    try {
      const savedPath = format === "png"
        ? await exportReportGraphAsPng(container, baseName)
        : await exportReportGraphAsPdf(container, baseName);
      addToast(formatFileSaveSuccessMessage(t, savedPath), "success");
    } catch (error) {
      const message = (error as Error)?.message ?? t("errors.fallback");
      setExportError(message);
      addToast(message, "error");
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("reports.title")}
        description={t("reports.description")}
      />

      <SectionCard title={t("reports.filters")}>
        <div className="grid gap-4 sm:grid-cols-3">
          <SelectField
            label={t("reports.reportType")}
              value={reportType}
              onChange={(v) => {
                const nextType = v as ReportType;
                setReportType(nextType);
                const firstSort = pickReportSort(nextType, sortOptions);
                const [sortBy, sortDir] = firstSort.split(":");
                table.update({
                q: "",
                sortBy,
                sortDir: (sortDir as "asc" | "desc") ?? "desc",
                page: 1
              });
            }}
            options={reportOptions}
          />
          <Field
            label={t("labels.startDate")}
            type="date"
            commitMode="blur"
            value={dateFrom}
            onChange={setDateFrom}
          />
          <Field
            label={t("labels.endDate")}
            type="date"
            commitMode="blur"
            value={dateTo}
            onChange={setDateTo}
          />
        </div>
      </SectionCard>

      <SectionCard
        title={reportOptions.find((o) => o.value === reportType)?.label ?? ""}
      >
        {exportError ? <FormAlert message={exportError} /> : null}
        <div className="mb-4 flex gap-2 justify-end">
          <button
            onClick={() => void exportLitigationSheet()}
            className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            aria-label={t("reports.exportLitigationSheet")}
          >
            {t("reports.exportLitigationSheet")}
          </button>
        </div>
        {isLoading && (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        )}
        {!isLoading && isError && (
          <ErrorState
            title={t("errors.title")}
            description={(error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void refetch()}
          />
        )}
        {!isLoading && !isError && (data?.items.length ?? 0) === 0 && (
          <p className="text-sm text-slate-500">{t("reports.noData")}</p>
        )}
        {!isLoading && !isError && (data?.items.length ?? 0) > 0 && (
          <>
            <TableToolbar>
              <Field
                label={t("labels.search")}
                value={table.state.q}
                onChange={table.setQ}
                placeholder={t("reports.searchPlaceholder")}
              />
              <SelectField
                label={t("labels.sort")}
                value={`${table.state.sortBy}:${table.state.sortDir}`}
                onChange={(value) => {
                  const [sortBy, sortDir] = value.split(":");
                  table.update({
                    sortBy,
                    sortDir: sortDir as "asc" | "desc",
                    page: 1
                  });
                }}
                options={sortOptions[reportType]}
              />
              <div className="flex items-end gap-2">
                <button
                  type="button"
                  role="tab"
                  aria-pressed={viewMode === "table"}
                  onClick={() => setViewMode("table")}
                  className={`rounded px-3 py-2 text-sm ${viewMode === "table" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
                >
                  {t("reports.tableView")}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-pressed={viewMode === "graph"}
                  onClick={() => setViewMode("graph")}
                  className={`rounded px-3 py-2 text-sm ${viewMode === "graph" ? "bg-slate-900 text-white" : "border border-slate-200 bg-white text-slate-700"}`}
                >
                  {t("reports.graphView")}
                </button>
              </div>
            </TableToolbar>
            <div className="mb-4 flex gap-2 justify-end">
              <button
                onClick={() => exportReport("excel")}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                aria-label={t("reports.exportExcel")}
              >
                {t("reports.exportExcel")}
              </button>
              <button
                onClick={() => exportReport("pdf")}
                className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                aria-label={t("reports.exportPdf")}
              >
                {t("reports.exportPdf")}
              </button>
              {viewMode === "graph" ? (
                <>
                  <button
                    onClick={() => void exportGraph("png")}
                    className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    aria-label={t("reports.exportGraphPng")}
                  >
                    {t("reports.exportGraphPng")}
                  </button>
                  <button
                    onClick={() => void exportGraph("pdf")}
                    className="rounded border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    aria-label={t("reports.exportGraphPdf")}
                  >
                    {t("reports.exportGraphPdf")}
                  </button>
                </>
              ) : null}
            </div>
            {viewMode === "table" ? (
              <ReportTable reportType={reportType} data={data?.items ?? []} />
            ) : (
              <ReportGraph
                ref={graphContainerRef}
                spec={graphSpec}
                t={t}
              />
            )}
            <TablePagination
              page={table.state.page}
              pageSize={table.state.limit}
              total={data?.total ?? 0}
              onPageChange={table.setPage}
              onPageSizeChange={table.setLimit}
            />
          </>
        )}
      </SectionCard>
    </div>
  );
}

function formatGraphValue(value: number, spec: ReportGraphSpec) {
  if (spec.valueFormat === "currency") return formatCurrency(value);
  if (spec.valueFormat === "days") return `${value}`;
  return `${value}`;
}

const ReportGraph = forwardRef<
  HTMLDivElement,
  { spec: ReportGraphSpec | null; t: (key: string) => string }
>(function ReportGraph({ spec, t }, ref) {
  if (!spec || spec.data.length === 0) {
    return <EmptyState title={t("reports.graphUnavailable")} description={t("reports.noData")} />;
  }

  return (
    <div ref={ref} className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="h-96 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {spec.chart === "line" ? (
            <LineChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={spec.xKey} />
              <YAxis />
              <Tooltip formatter={(v) => formatGraphValue(Number(v), spec)} />
              <Legend />
              {spec.series.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={t(s.labelKey)} stroke={s.color} strokeWidth={2} />
              ))}
            </LineChart>
          ) : spec.chart === "area" ? (
            <AreaChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={spec.xKey} />
              <YAxis />
              <Tooltip formatter={(v) => formatGraphValue(Number(v), spec)} />
              <Legend />
              {spec.series.map((s) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={t(s.labelKey)} stroke={s.color} fill={s.color} fillOpacity={0.15} />
              ))}
            </AreaChart>
          ) : spec.chart === "combo" ? (
            <LineChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={spec.xKey} />
              <YAxis />
              <Tooltip formatter={(v) => formatGraphValue(Number(v), spec)} />
              <Legend />
              {spec.series.map((s, idx) =>
                idx < 2 ? (
                  <Bar key={s.key} dataKey={s.key} name={t(s.labelKey)} fill={s.color} />
                ) : (
                  <Line key={s.key} type="monotone" dataKey={s.key} name={t(s.labelKey)} stroke={s.color} strokeWidth={2} />
                )
              )}
            </LineChart>
          ) : (
            <BarChart data={spec.data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey={spec.xKey} />
              <YAxis />
              <Tooltip formatter={(v) => formatGraphValue(Number(v), spec)} />
              <Legend />
              {spec.series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={t(s.labelKey)} fill={s.color} />
              ))}
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
});

function ReportTable({
  reportType,
  data
}: {
  reportType: ReportType;
  data: Array<
    | CaseStatusRow
    | ArAgingRow
    | CashflowMonthlyRow
    | DsoCollectionLagRow
    | EarningsLossesRow
    | HearingOutcomeRow
    | InvoiceVoidTrendRow
    | LawyerWorkloadRow
    | RevenueReportRow
    | OutstandingBalanceRow
  >;
}) {
  const { t } = useTranslation("app");
  const hearingOutcomesQuery = useLocalizedLookupOptions("HearingOutcome");

  if (reportType === "case-status") {
    const rows = data as CaseStatusRow[];
    return (
      <>
        <div className="space-y-2 sm:hidden">
          {rows.map((r) => (
            <article
              key={r.status}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="text-xs text-slate-500">{t("labels.status")}</p>
              <p className="font-semibold">{r.status}</p>
              <p className="mt-2 text-xs text-slate-500">
                {t("reports.count")}
              </p>
              <p className="font-semibold">{r.count}</p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-start font-medium">
                  {t("labels.status")}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t("reports.count")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.status} className="border-b border-slate-50">
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 text-end font-semibold">
                    {r.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (reportType === "hearing-outcomes") {
    const rows = data as HearingOutcomeRow[];
    return (
      <>
        <div className="space-y-2 sm:hidden">
          {rows.map((r, i) => (
            <article
              key={i}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="text-xs text-slate-500">{t("labels.outcome")}</p>
              <p className="font-semibold">
                {r.outcome ? hearingOutcomesQuery.getLabel(r.outcome) : "—"}
              </p>
              <p className="mt-2 text-xs text-slate-500">
                {t("reports.count")}
              </p>
              <p className="font-semibold">{r.count}</p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-start font-medium">
                  {t("labels.outcome")}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t("reports.count")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-3 py-2">
                    {r.outcome ? hearingOutcomesQuery.getLabel(r.outcome) : "—"}
                  </td>
                  <td className="px-3 py-2 text-end font-semibold">
                    {r.count}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (reportType === "lawyer-workload") {
    const rows = data as LawyerWorkloadRow[];
    return (
      <>
        <div className="space-y-2 sm:hidden">
          {rows.map((r) => (
            <article
              key={r.userId}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="font-semibold">{r.fullName}</p>
              <p className="mt-2 text-xs text-slate-500">
                {t("reports.openCases")}: {r.openCases}
              </p>
              <p className="text-xs text-slate-500">
                {t("reports.openTasks")}: {r.openTasks}
              </p>
              <p className="text-xs text-slate-500">
                {t("reports.upcomingHearings")}: {r.upcomingHearings}
              </p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-start font-medium">
                  {t("labels.user")}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t("reports.openCases")}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t("reports.openTasks")}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t("reports.upcomingHearings")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.userId} className="border-b border-slate-50">
                  <td className="px-3 py-2">{r.fullName}</td>
                  <td className="px-3 py-2 text-end">{r.openCases}</td>
                  <td className="px-3 py-2 text-end">{r.openTasks}</td>
                  <td className="px-3 py-2 text-end">{r.upcomingHearings}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (reportType === "revenue") {
    const rows = data as RevenueReportRow[];
    return (
      <>
        <div className="space-y-2 sm:hidden">
          {rows.map((r) => (
            <article
              key={r.month}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="font-semibold">{r.month}</p>
              <p className="mt-2 text-xs text-slate-500">
                {t("billing.totalBilled")}
              </p>
              <p>{formatCurrency(r.invoiced)}</p>
              <p className="mt-1 text-xs text-slate-500">
                {t("billing.totalPaid")}
              </p>
              <p className="font-semibold text-emerald-700">
                {formatCurrency(r.paid)}
              </p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-start font-medium">
                  {t("reports.month")}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t("billing.totalBilled")}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t("billing.totalPaid")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b border-slate-50">
                  <td className="px-3 py-2">{r.month}</td>
                  <td className="px-3 py-2 text-end">
                    {formatCurrency(r.invoiced)}
                  </td>
                  <td className="px-3 py-2 text-end font-semibold text-emerald-700">
                    {formatCurrency(r.paid)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (reportType === "outstanding-balances") {
    const rows = data as OutstandingBalanceRow[];
    return (
      <>
        <div className="space-y-2 sm:hidden">
          {rows.map((r) => (
            <article
              key={r.invoiceId}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="font-semibold">{r.invoiceNumber}</p>
              <p className="text-sm text-slate-500">{r.clientName ?? "—"}</p>
              <p className="mt-2 text-xs text-slate-500">
                {t("billing.total")}
              </p>
              <p>{formatCurrency(r.totalAmount)}</p>
              <p className="mt-1 text-xs font-semibold text-red-600">
                {t("reports.daysOverdue")}: {r.daysOverdue}
              </p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-start font-medium">
                  {t("billing.invoice")}
                </th>
                <th className="px-3 py-2 text-start font-medium">
                  {t("labels.client")}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t("billing.total")}
                </th>
                <th className="px-3 py-2 text-end font-medium">
                  {t("reports.daysOverdue")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.invoiceId} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-medium">{r.invoiceNumber}</td>
                  <td className="px-3 py-2 text-slate-600">
                    {r.clientName ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-end">
                    {formatCurrency(r.totalAmount)}
                  </td>
                  <td className="px-3 py-2 text-end text-red-600 font-semibold">
                    {r.daysOverdue}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (reportType === "earnings-losses") {
    const rows = data as EarningsLossesRow[];
    return (
      <>
        <div className="space-y-2 sm:hidden">
          {rows.map((r) => (
            <article
              key={r.month}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <p className="font-semibold">{r.month}</p>
              <p className="mt-2 text-xs text-slate-500">{t("reports.cashEarnings")}</p>
              <p>{formatCurrency(r.cashEarnings)}</p>
              <p className="mt-1 text-xs text-slate-500">{t("reports.accrualEarnings")}</p>
              <p>{formatCurrency(r.accrualEarnings)}</p>
              <p className="mt-1 text-xs text-slate-500">{t("reports.totalLosses")}</p>
              <p className="font-semibold text-red-700">{formatCurrency(r.totalLosses)}</p>
              <p className="mt-1 text-xs text-slate-500">{t("reports.netProfitCash")}</p>
              <p className="font-semibold">{formatCurrency(r.netProfitCash)}</p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-start font-medium">{t("reports.month")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.cashEarnings")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.accrualEarnings")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.operatingExpenses")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.invoiceLosses")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.totalLosses")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.netProfitCash")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.netProfitAccrual")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b border-slate-50">
                  <td className="px-3 py-2">{r.month}</td>
                  <td className="px-3 py-2 text-end">{formatCurrency(r.cashEarnings)}</td>
                  <td className="px-3 py-2 text-end">{formatCurrency(r.accrualEarnings)}</td>
                  <td className="px-3 py-2 text-end">{formatCurrency(r.operatingExpenses)}</td>
                  <td className="px-3 py-2 text-end">{formatCurrency(r.invoiceLosses)}</td>
                  <td className="px-3 py-2 text-end font-semibold text-red-700">{formatCurrency(r.totalLosses)}</td>
                  <td className="px-3 py-2 text-end font-semibold">{formatCurrency(r.netProfitCash)}</td>
                  <td className="px-3 py-2 text-end font-semibold">{formatCurrency(r.netProfitAccrual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  if (reportType === "dso-collection-lag") {
    const rows = data as DsoCollectionLagRow[];
    return (
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 text-start font-medium">{t("reports.month")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("reports.paidInvoices")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("reports.avgCollectionDays")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-slate-50">
                <td className="px-3 py-2">{r.month}</td>
                <td className="px-3 py-2 text-end">{r.paidInvoices}</td>
                <td className="px-3 py-2 text-end font-semibold">{r.avgCollectionDays}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (reportType === "invoice-void-trend") {
    const rows = data as InvoiceVoidTrendRow[];
    return (
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 text-start font-medium">{t("reports.month")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("reports.voidCount")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("reports.voidAmount")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-slate-50">
                <td className="px-3 py-2">{r.month}</td>
                <td className="px-3 py-2 text-end">{r.voidCount}</td>
                <td className="px-3 py-2 text-end font-semibold text-red-700">{formatCurrency(r.voidAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (reportType === "cashflow-monthly") {
    const rows = data as CashflowMonthlyRow[];
    return (
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 text-start font-medium">{t("reports.month")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("reports.cashIn")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("reports.cashOut")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("reports.netCash")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.month} className="border-b border-slate-50">
                <td className="px-3 py-2">{r.month}</td>
                <td className="px-3 py-2 text-end">{formatCurrency(r.cashIn)}</td>
                <td className="px-3 py-2 text-end">{formatCurrency(r.cashOut)}</td>
                <td className="px-3 py-2 text-end font-semibold">{formatCurrency(r.netCash)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (reportType === "ar-aging") {
    const rows = data as ArAgingRow[];
    return (
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="px-3 py-2 text-start font-medium">{t("billing.invoiceNumber")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("labels.client")}</th>
              <th className="px-3 py-2 text-start font-medium">{t("reports.caseTitle")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("reports.balanceDue")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("reports.daysOverdue")}</th>
              <th className="px-3 py-2 text-end font-medium">{t("reports.agingBucket")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.invoiceId} className="border-b border-slate-50">
                <td className="px-3 py-2">{r.invoiceNumber}</td>
                <td className="px-3 py-2">{r.clientName ?? "—"}</td>
                <td className="px-3 py-2">{r.caseTitle ?? "—"}</td>
                <td className="px-3 py-2 text-end font-semibold">{formatCurrency(r.balanceDue)}</td>
                <td className="px-3 py-2 text-end">{r.daysOverdue}</td>
                <td className="px-3 py-2 text-end">{r.agingBucket}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <EmptyState
      title={t("errors.notFound")}
      description={t("reports.noData")}
    />
  );
}
