import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Plus, Play, Trash2, Download, Loader2 } from "lucide-react";
import { useToastStore } from "../../store/toastStore";
import { apiFetch } from "../../lib/api";
import { useTableQueryState } from "../../lib/tableQueryState";
import { FormAlert, PageHeader, SectionCard, PrimaryButton, Field, SelectField, TablePagination, TableToolbar, formatDateTime } from "./ui";
import { downloadReportFile } from "./reportExport";

type ReportType = "case-status" | "hearing-outcomes" | "lawyer-workload" | "revenue" | "outstanding-balances";

interface CustomReportDto {
  id: string;
  name: string;
  description: string | null;
  reportType: ReportType;
  config: { dateFrom?: string; dateTo?: string };
  createdAt: string;
}

interface RunSessionResult {
  runId: string;
  reportType: string;
  ranAt: string;
  total: number;
  expiresAt: string;
}

interface RunRowsResult {
  items: Record<string, unknown>[];
  total: number;
  page: number;
  pageSize: number;
}

const REPORT_TYPES: ReportType[] = [
  "case-status",
  "hearing-outcomes",
  "lawyer-workload",
  "revenue",
  "outstanding-balances"
];

const EMPTY_FORM = { name: "", description: "", reportType: "case-status" as ReportType, dateFrom: "", dateTo: "" };

export function ReportBuilderPage() {
  const { t } = useTranslation("app");
  const addToast = useToastStore((state) => state.addToast);
  const queryClient = useQueryClient();
  const [form, setForm] = useState(EMPTY_FORM);
  const [showForm, setShowForm] = useState(false);
  const [runResult, setRunResult] = useState<{ id: string; data: RunSessionResult } | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const table = useTableQueryState({
    defaultSortBy: "value",
    defaultSortDir: "asc",
    defaultLimit: 20
  });

  const reportsQuery = useQuery({
    queryKey: ["custom-reports"],
    queryFn: () => apiFetch<CustomReportDto[]>("/api/reports/custom")
  });

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch<CustomReportDto>("/api/reports/custom", {
        method: "POST",
        body: JSON.stringify({
          name: form.name,
          description: form.description || undefined,
          reportType: form.reportType,
          config: { dateFrom: form.dateFrom || undefined, dateTo: form.dateTo || undefined }
        })
      }),
    onSuccess: () => {
      setActionError(null);
      setForm(EMPTY_FORM);
      setShowForm(false);
      void queryClient.invalidateQueries({ queryKey: ["custom-reports"] });
    },
    onError: (error: Error) => {
      setActionError(error.message || t("errors.fallback"));
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/reports/custom/${id}`, { method: "DELETE" }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["custom-reports"] })
  });

  async function handleRun(id: string) {
    setRunningId(id);
    setActionError(null);
    try {
      const data = await apiFetch<RunSessionResult>(`/api/reports/custom/${id}/run`, { method: "POST" });
      setRunResult({ id, data });
    } catch (error) {
      setActionError((error as Error)?.message ?? t("errors.fallback"));
    } finally {
      setRunningId(null);
    }
  }

  async function handleExport(id: string) {
    setExportError(null);
    try {
      await downloadReportFile(
        `/api/reports/custom/${id}/export?format=excel`,
        `custom-report-${id}.xlsx`
      );
      addToast(t("reports.exportReady", { format: "Excel" }), "success");
    } catch (error) {
      const message = (error as Error)?.message ?? t("errors.fallback");
      setExportError(message);
      addToast(message, "error");
    }
  }

  const reports = reportsQuery.data ?? [];

  const runRowsQuery = useQuery({
    queryKey: ["custom-report-rows", runResult?.data.runId, table.state],
    queryFn: () =>
      apiFetch<RunRowsResult>(
        `/api/reports/custom/runs/${runResult!.data.runId}/rows?${table.toApiQueryString()}`
      ),
    enabled: Boolean(runResult?.data.runId)
  });

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("reports.builderDescription")}
        eyebrow={t("reports.eyebrow")}
        title={t("reports.builderTitle")}
        actions={
          <PrimaryButton onClick={() => setShowForm(true)}>
            <Plus className="size-4" />
            {t("reports.newReport")}
          </PrimaryButton>
        }
      />

      {/* Create form */}
      {showForm && (
        <SectionCard title={t("reports.newReport")}>
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field
                label={t("reports.reportName")}
                value={form.name}
                onChange={(value) => setForm({ ...form, name: value })}
              />
              <SelectField
                label={t("reports.reportType")}
                value={form.reportType}
                onChange={(v) => setForm({ ...form, reportType: v as ReportType })}
                options={REPORT_TYPES.map((rt) => ({
                  value: rt,
                  label: t(`reports.type.${rt}`)
                }))}
              />
            </div>
            <Field
              label={t("reports.description")}
              value={form.description}
              onChange={(value) => setForm({ ...form, description: value })}
            />
            <div className="grid grid-cols-2 gap-3">
              <Field
                label={t("reports.dateFrom")}
                type="date"
                commitMode="blur"
                value={form.dateFrom}
                onChange={(value) => setForm({ ...form, dateFrom: value })}
              />
              <Field
                label={t("reports.dateTo")}
                type="date"
                commitMode="blur"
                value={form.dateTo}
                onChange={(value) => setForm({ ...form, dateTo: value })}
              />
            </div>
            <div className="flex gap-2">
              <PrimaryButton
                disabled={!form.name.trim() || createMutation.isPending}
                onClick={() => createMutation.mutate()}
              >
                {createMutation.isPending ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("actions.save")}
              </PrimaryButton>
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={() => setShowForm(false)}>
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Saved reports list */}
      <SectionCard title={t("reports.savedReports")}>
        {exportError ? <FormAlert message={exportError} /> : null}
        {actionError ? <FormAlert message={actionError} /> : null}
        {reportsQuery.isLoading ? (
          <p className="text-sm text-slate-500">{t("labels.loading")}</p>
        ) : reportsQuery.isError ? (
          <FormAlert message={(reportsQuery.error as Error)?.message ?? t("errors.fallback")} />
        ) : !reports.length ? (
          <p className="text-sm text-slate-500">{t("empty.noCustomReports")}</p>
        ) : (
          <div className="space-y-2">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <div className="flex-1">
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-sm text-slate-500">{t(`reports.type.${r.reportType}`)}
                    {r.config.dateFrom && ` · ${r.config.dateFrom}`}
                    {r.config.dateTo && ` → ${r.config.dateTo}`}
                  </p>
                </div>
                <button
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:text-accent"
                  disabled={runningId === r.id}
                  onClick={() => handleRun(r.id)}
                >
                  {runningId === r.id ? <Loader2 className="size-4 animate-spin" /> : <Play className="size-4" />}
                  {t("reports.run")}
                </button>
                <button
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-600 hover:text-accent"
                  onClick={() => void handleExport(r.id)}
                >
                  <Download className="size-4" />
                  {t("reports.exportExcel")}
                </button>
                <button
                  className="rounded-lg p-1.5 text-slate-400 hover:text-red-500"
                  onClick={() => deleteMutation.mutate(r.id)}
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {/* Run result */}
      {runResult && (
        <SectionCard title={t("reports.results")}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-500">{t("reports.ranAt")}: {formatDateTime(runResult.data.ranAt)}</p>
              <button className="text-sm text-slate-400 hover:text-slate-600" onClick={() => setRunResult(null)}>
                {t("actions.close")}
              </button>
            </div>
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
                options={[
                  { value: "value:asc", label: "A-Z" },
                  { value: "value:desc", label: "Z-A" }
                ]}
              />
            </TableToolbar>
            {runRowsQuery.isLoading ? (
              <p className="text-sm text-slate-500">{t("labels.loading")}</p>
            ) : runRowsQuery.data?.items.length ? (
              <div className="overflow-auto rounded-2xl border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50">
                    <tr>
                      {Object.keys(runRowsQuery.data.items[0]).map((k) => (
                        <th key={k} className="px-3 py-2 text-start font-semibold text-slate-600">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {runRowsQuery.data.items.map((row, i) => (
                      <tr key={i} className="border-b last:border-0">
                        {Object.values(row).map((v, j) => (
                          <td key={j} className="px-3 py-2">{String(v ?? "-")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : runRowsQuery.isError ? (
              <FormAlert message={(runRowsQuery.error as Error)?.message ?? t("errors.fallback")} />
            ) : (
              <p className="text-sm text-slate-400">{t("empty.noData")}</p>
            )}
            <TablePagination
              page={table.state.page}
              pageSize={table.state.limit}
              total={runRowsQuery.data?.total ?? 0}
              onPageChange={table.setPage}
              onPageSizeChange={table.setLimit}
            />
          </div>
        </SectionCard>
      )}
    </div>
  );
}
