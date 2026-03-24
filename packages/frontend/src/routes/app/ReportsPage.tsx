import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { apiFetch, resolveApiUrl } from "../../lib/api";
import { Field, PageHeader, SectionCard, SelectField } from "./ui";
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

  const { data, isLoading } = useQuery({
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
            value={dateFrom}
            onChange={setDateFrom}
          />
          <Field
            label={t("labels.endDate")}
            type="date"
            value={dateTo}
            onChange={setDateTo}
          />
        </div>
      </SectionCard>

      <SectionCard title={reportOptions.find((o) => o.value === reportType)?.label ?? ""}>
        {isLoading && <p className="text-sm text-slate-500">{t("labels.loading")}</p>}
        {!isLoading && Array.isArray(data) && data.length === 0 && (
          <p className="text-sm text-slate-500">{t("reports.noData")}</p>
        )}
        {!isLoading && Array.isArray(data) && data.length > 0 && (
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="py-2 text-start font-medium">{t("labels.status")}</th>
            <th className="py-2 text-end font-medium">{t("reports.count")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.status} className="border-b border-slate-50">
              <td className="py-2">{r.status}</td>
              <td className="py-2 text-end font-semibold">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportType === "hearing-outcomes") {
    const rows = data as HearingOutcomeRow[];
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="py-2 text-start font-medium">{t("labels.outcome")}</th>
            <th className="py-2 text-end font-medium">{t("reports.count")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-slate-50">
              <td className="py-2">{r.outcome ?? "—"}</td>
              <td className="py-2 text-end font-semibold">{r.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportType === "lawyer-workload") {
    const rows = data as LawyerWorkloadRow[];
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="py-2 text-start font-medium">{t("labels.user")}</th>
            <th className="py-2 text-end font-medium">{t("reports.openCases")}</th>
            <th className="py-2 text-end font-medium">{t("reports.openTasks")}</th>
            <th className="py-2 text-end font-medium">{t("reports.upcomingHearings")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.userId} className="border-b border-slate-50">
              <td className="py-2">{r.fullName}</td>
              <td className="py-2 text-end">{r.openCases}</td>
              <td className="py-2 text-end">{r.openTasks}</td>
              <td className="py-2 text-end">{r.upcomingHearings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportType === "revenue") {
    const rows = data as RevenueReportRow[];
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="py-2 text-start font-medium">{t("reports.month")}</th>
            <th className="py-2 text-end font-medium">{t("billing.totalBilled")}</th>
            <th className="py-2 text-end font-medium">{t("billing.totalPaid")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.month} className="border-b border-slate-50">
              <td className="py-2">{r.month}</td>
              <td className="py-2 text-end">{r.invoiced}</td>
              <td className="py-2 text-end font-semibold text-emerald-700">{r.paid}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  if (reportType === "outstanding-balances") {
    const rows = data as OutstandingBalanceRow[];
    return (
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="py-2 text-start font-medium">{t("billing.invoice")}</th>
            <th className="py-2 text-start font-medium">{t("labels.client")}</th>
            <th className="py-2 text-end font-medium">{t("billing.total")}</th>
            <th className="py-2 text-end font-medium">{t("reports.daysOverdue")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.invoiceId} className="border-b border-slate-50">
              <td className="py-2 font-medium">{r.invoiceNumber}</td>
              <td className="py-2 text-slate-600">{r.clientName ?? "—"}</td>
              <td className="py-2 text-end">{r.totalAmount}</td>
              <td className="py-2 text-end text-red-600 font-semibold">{r.daysOverdue}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return null;
}
