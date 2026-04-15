import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useToastStore } from "../../store/toastStore";
import { apiFetch } from "../../lib/api";
import { useTableQueryState } from "../../lib/tableQueryState";
import { EmptyState, ErrorState, Field, FormAlert, PageHeader, SectionCard, SelectField, TablePagination, TableToolbar, formatCurrency } from "./ui";
import { downloadReportFile } from "./reportExport";
import type {
  CaseStatusRow,
  HearingOutcomeRow,
  LawyerWorkloadRow,
  OutstandingBalanceRow,
  ReportType,
  ReportListResponseByType,
  RevenueReportRow
} from "../../lib/reports";
import { parseReportListResponse } from "../../lib/reports";

export function ReportsPage() {
  const { t } = useTranslation("app");
  const addToast = useToastStore((state) => state.addToast);
  const [reportType, setReportType] = useState<ReportType>("case-status");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [exportError, setExportError] = useState<string | null>(null);
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

  const reportOptions: { value: ReportType; label: string }[] = [
    { value: "case-status", label: t("reports.caseStatus") },
    { value: "hearing-outcomes", label: t("reports.hearingOutcomes") },
    { value: "lawyer-workload", label: t("reports.lawyerWorkload") },
    { value: "revenue", label: t("reports.revenue") },
    { value: "outstanding-balances", label: t("reports.outstandingBalances") }
  ];

  const sortOptions: Record<ReportType, Array<{ value: string; label: string }>> = {
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
    ]
  };

  async function exportReport(format: "excel" | "pdf") {
    setExportError(null);
    const exportQs = new URLSearchParams(table.toApiQueryString({ dateFrom, dateTo }));
    exportQs.set("format", format);
    const fallbackFilename = `report-${reportType}.${format === "pdf" ? "pdf" : "xlsx"}`;

    try {
      await downloadReportFile(
        `/api/reports/${reportType}/export?${exportQs.toString()}`,
        fallbackFilename
      );
      addToast(
        t("reports.exportReady", { format: format === "pdf" ? "PDF" : "Excel" }),
        "success"
      );
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
              const firstSort = sortOptions[nextType][0]?.value ?? "count:desc";
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

      <SectionCard title={reportOptions.find((o) => o.value === reportType)?.label ?? ""}>
        {exportError ? <FormAlert message={exportError} /> : null}
        {isLoading && <p className="text-sm text-slate-500">{t("labels.loading")}</p>}
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
                  table.update({ sortBy, sortDir: sortDir as "asc" | "desc", page: 1 });
                }}
                options={sortOptions[reportType]}
              />
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
            </div>
            <ReportTable reportType={reportType} data={data?.items ?? []} />
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

function ReportTable({
  reportType,
  data
}: {
  reportType: ReportType;
  data: Array<CaseStatusRow | HearingOutcomeRow | LawyerWorkloadRow | RevenueReportRow | OutstandingBalanceRow>;
}) {
  const { t } = useTranslation("app");

  if (reportType === "case-status") {
    const rows = data as CaseStatusRow[];
    return (
      <>
        <div className="space-y-2 sm:hidden">
          {rows.map((r) => (
            <article key={r.status} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">{t("labels.status")}</p>
              <p className="font-semibold">{r.status}</p>
              <p className="mt-2 text-xs text-slate-500">{t("reports.count")}</p>
              <p className="font-semibold">{r.count}</p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-start font-medium">{t("labels.status")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.count")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.status} className="border-b border-slate-50">
                  <td className="px-3 py-2">{r.status}</td>
                  <td className="px-3 py-2 text-end font-semibold">{r.count}</td>
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
            <article key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="text-xs text-slate-500">{t("labels.outcome")}</p>
              <p className="font-semibold">{r.outcome ?? "—"}</p>
              <p className="mt-2 text-xs text-slate-500">{t("reports.count")}</p>
              <p className="font-semibold">{r.count}</p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-start font-medium">{t("labels.outcome")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.count")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-slate-50">
                  <td className="px-3 py-2">{r.outcome ?? "—"}</td>
                  <td className="px-3 py-2 text-end font-semibold">{r.count}</td>
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
            <article key={r.userId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-semibold">{r.fullName}</p>
              <p className="mt-2 text-xs text-slate-500">{t("reports.openCases")}: {r.openCases}</p>
              <p className="text-xs text-slate-500">{t("reports.openTasks")}: {r.openTasks}</p>
              <p className="text-xs text-slate-500">{t("reports.upcomingHearings")}: {r.upcomingHearings}</p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-start font-medium">{t("labels.user")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.openCases")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.openTasks")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.upcomingHearings")}</th>
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
            <article key={r.month} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-semibold">{r.month}</p>
              <p className="mt-2 text-xs text-slate-500">{t("billing.totalBilled")}</p>
              <p>{formatCurrency(r.invoiced)}</p>
              <p className="mt-1 text-xs text-slate-500">{t("billing.totalPaid")}</p>
              <p className="font-semibold text-emerald-700">{formatCurrency(r.paid)}</p>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 sm:block">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-3 py-2 text-start font-medium">{t("reports.month")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("billing.totalBilled")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("billing.totalPaid")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.month} className="border-b border-slate-50">
                  <td className="px-3 py-2">{r.month}</td>
                  <td className="px-3 py-2 text-end">{formatCurrency(r.invoiced)}</td>
                  <td className="px-3 py-2 text-end font-semibold text-emerald-700">{formatCurrency(r.paid)}</td>
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
            <article key={r.invoiceId} className="rounded-2xl border border-slate-200 bg-white p-4">
              <p className="font-semibold">{r.invoiceNumber}</p>
              <p className="text-sm text-slate-500">{r.clientName ?? "—"}</p>
              <p className="mt-2 text-xs text-slate-500">{t("billing.total")}</p>
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
                <th className="px-3 py-2 text-start font-medium">{t("billing.invoice")}</th>
                <th className="px-3 py-2 text-start font-medium">{t("labels.client")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("billing.total")}</th>
                <th className="px-3 py-2 text-end font-medium">{t("reports.daysOverdue")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.invoiceId} className="border-b border-slate-50">
                  <td className="px-3 py-2 font-medium">{r.invoiceNumber}</td>
                  <td className="px-3 py-2 text-slate-600">{r.clientName ?? "—"}</td>
                  <td className="px-3 py-2 text-end">{formatCurrency(r.totalAmount)}</td>
                  <td className="px-3 py-2 text-end text-red-600 font-semibold">{r.daysOverdue}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </>
    );
  }

  return <EmptyState title={t("errors.notFound")} description={t("reports.noData")} />;
}
