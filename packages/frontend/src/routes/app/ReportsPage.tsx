import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch, resolveApiUrl } from "../../lib/api";
import { EmptyState, ErrorState, Field, PageHeader, SectionCard, SelectField, formatCurrency } from "./ui";
import type {
  CaseStatusRow,
  HearingOutcomeRow,
  LawyerWorkloadRow,
  OutstandingBalanceRow,
  RevenueReportRow
} from "../../lib/reports";

type ReportType = "case-status" | "hearing-outcomes" | "lawyer-workload" | "revenue" | "outstanding-balances";

function triggerDownload(url: string) {
  const a = document.createElement("a");
  a.href = resolveApiUrl(url);
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function ReportsPage() {
  const { t } = useTranslation("app");
  const [reportType, setReportType] = useState<ReportType>("case-status");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const qs = new URLSearchParams();
  if (dateFrom) qs.set("dateFrom", dateFrom);
  if (dateTo) qs.set("dateTo", dateTo);
  const qsStr = qs.toString();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["reports", reportType, dateFrom, dateTo],
    queryFn: () =>
      apiFetch<unknown>(`/api/reports/${reportType}${qsStr ? `?${qsStr}` : ""}`)
  });

  const reportOptions: { value: ReportType; label: string }[] = [
    { value: "case-status", label: t("reports.caseStatus") },
    { value: "hearing-outcomes", label: t("reports.hearingOutcomes") },
    { value: "lawyer-workload", label: t("reports.lawyerWorkload") },
    { value: "revenue", label: t("reports.revenue") },
    { value: "outstanding-balances", label: t("reports.outstandingBalances") }
  ];

  function exportReport(format: "excel" | "pdf") {
    const exportQs = new URLSearchParams({ format });
    if (dateFrom) exportQs.set("dateFrom", dateFrom);
    if (dateTo) exportQs.set("dateTo", dateTo);
    triggerDownload(`/api/reports/${reportType}/export?${exportQs.toString()}`);
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
            onChange={(v) => setReportType(v as ReportType)}
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
        {isLoading && <p className="text-sm text-slate-500">{t("labels.loading")}</p>}
        {!isLoading && isError && (
          <ErrorState
            title={t("errors.title")}
            description={(error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void refetch()}
          />
        )}
        {!isLoading && !isError && Array.isArray(data) && data.length === 0 && (
          <p className="text-sm text-slate-500">{t("reports.noData")}</p>
        )}
        {!isLoading && !isError && Array.isArray(data) && data.length > 0 && (
          <>
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
            <ReportTable reportType={reportType} data={data} />
          </>
        )}
      </SectionCard>
    </div>
  );
}

function ReportTable({ reportType, data }: { reportType: ReportType; data: unknown }) {
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
