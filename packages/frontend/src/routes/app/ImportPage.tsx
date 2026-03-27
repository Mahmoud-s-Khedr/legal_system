import React, { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Upload, AlertCircle, CheckCircle2, XCircle, Loader2, Download } from "lucide-react";
import { apiFetch, apiFormFetch } from "../../lib/api";
import { useTableQueryState } from "../../lib/tableQueryState";
import { Field, PageHeader, SectionCard, PrimaryButton, SelectField, TablePagination, TableToolbar } from "./ui";

type EntityType = "clients" | "cases";

interface RowError { rowNumber: number; error: string }

interface PreviewResult {
  previewId: string;
  total: number;
  valid: number;
  invalid: number;
  expiresAt: string;
}

interface PreviewRowsResult {
  items: Array<{
    rowNumber: number;
    data: Record<string, string>;
    errors: string[];
  }>;
  total: number;
  page: number;
  pageSize: number;
  expiresAt: string;
}

interface ExecuteResult {
  imported: number;
  failed: number;
  errors: RowError[];
}

type Step = "upload" | "preview" | "results";

async function uploadPreviewFile(
  entityType: EntityType,
  file: File
): Promise<PreviewResult> {
  const fd = new FormData();
  fd.append("file", file);
  return apiFormFetch<PreviewResult>(`/api/import/${entityType}/preview`, {
    method: "POST",
    body: fd
  });
}

async function executeFromPreview(
  entityType: EntityType,
  previewId: string,
  fallbackMessage: string
): Promise<ExecuteResult> {
  try {
    return await apiFetch<ExecuteResult>(`/api/import/${entityType}/execute-preview`, {
      method: "POST",
      body: JSON.stringify({ previewId })
    });
  } catch (error) {
    throw new Error((error as Error)?.message ?? fallbackMessage);
  }
}

function downloadErrorReport(errors: RowError[]) {
  const csv = "Row,Error\n" + errors.map((e) => `${e.rowNumber},"${e.error.replace(/"/g, '""')}"`).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "import-errors.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function ImportPage() {
  const { t } = useTranslation("app");
  const fileRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("upload");
  const [entityType, setEntityType] = useState<EntityType>("clients");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const table = useTableQueryState({
    defaultSortBy: "rowNumber",
    defaultSortDir: "asc",
    defaultLimit: 20,
    filterKeys: ["status"]
  });

  const previewRowsQuery = useQuery({
    queryKey: ["import-preview-rows", preview?.previewId, table.state],
    queryFn: () =>
      apiFetch<PreviewRowsResult>(
        `/api/import/previews/${preview!.previewId}/rows?${table.toApiQueryString()}`
      ),
    enabled: Boolean(preview?.previewId && step === "preview")
  });

  async function handlePreview() {
    if (!file) return;
    setLoading(true);
    setError(null);
    try {
      const data = await uploadPreviewFile(entityType, file);
      setPreview(data);
      setStep("preview");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fallback"));
    } finally {
      setLoading(false);
    }
  }

  async function handleExecute() {
    if (!preview?.previewId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await executeFromPreview(entityType, preview.previewId, t("errors.fallback"));
      setResult(data);
      setStep("results");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("errors.fallback"));
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("upload");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("import.description")}
        eyebrow={t("import.eyebrow")}
        title={t("import.title")}
      />

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {(["upload", "preview", "results"] as Step[]).map((s, i) => (
          <React.Fragment key={s}>
            {i > 0 && <div className="h-px w-8 bg-slate-200" />}
            <div className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${step === s ? "bg-accent text-white" : "bg-slate-100 text-slate-500"}`}>
              <span className="font-semibold">{i + 1}.</span>
              <span>{t(`import.step.${s}`)}</span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {error && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <AlertCircle className="size-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <SectionCard title={t("import.uploadFile")}>
          <div className="space-y-4">
            <div className="flex gap-3">
              {(["clients", "cases"] as EntityType[]).map((et) => (
                <button
                  key={et}
                  className={`flex-1 rounded-xl border py-3 text-sm font-semibold transition-colors ${entityType === et ? "border-accent bg-accentSoft text-accent" : "border-slate-200 bg-white text-slate-600"}`}
                  onClick={() => setEntityType(et)}
                >
                  {t(`import.entity.${et}`)}
                </button>
              ))}
            </div>

            <div
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-10 hover:border-accent hover:bg-accentSoft"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="mb-3 size-8 text-slate-400" />
              {file ? (
                <p className="font-medium text-accent">{file.name}</p>
              ) : (
                <>
                  <p className="font-medium text-slate-600">{t("import.dropFile")}</p>
                  <p className="text-sm text-slate-400">{t("import.allowedTypes")}</p>
                </>
              )}
            </div>
            <input
              ref={fileRef}
              accept=".csv,.xlsx,.xls"
              className="hidden"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />

            {/* Download template link */}
            <p className="text-sm text-slate-500">
              {t("import.templateHint")}{" "}
              <button
                className="text-accent underline"
                onClick={() => {
                  const headers = entityType === "clients"
                    ? "name,type,phone,email,nationalId,governorate"
                    : "title,caseNumber,type,status,internalReference,judicialYear,client_id";
                  const blob = new Blob([headers + "\n"], { type: "text/csv" });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `${entityType}-import-template.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
              >
                {t("import.downloadTemplate")}
              </button>
            </p>

            <PrimaryButton disabled={!file || loading} onClick={handlePreview}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : null}
              {t("import.preview")}
            </PrimaryButton>
          </div>
        </SectionCard>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && preview && (
        <SectionCard title={t("import.previewTitle")}>
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <div className="rounded-xl bg-slate-100 px-4 py-2">
                <span className="font-semibold">{preview.total}</span> {t("import.totalRows")}
              </div>
              <div className="rounded-xl bg-green-50 px-4 py-2 text-green-700">
                <span className="font-semibold">{preview.valid}</span> {t("import.validRows")}
              </div>
              <div className="rounded-xl bg-red-50 px-4 py-2 text-red-700">
                <span className="font-semibold">{preview.invalid}</span> {t("import.invalidRows")}
              </div>
            </div>

            <TableToolbar>
              <Field
                label={t("labels.search")}
                value={table.state.q}
                onChange={table.setQ}
                placeholder={t("import.searchPlaceholder")}
              />
              <SelectField
                label={t("labels.status")}
                value={table.state.filters.status ?? ""}
                onChange={(value) => table.setFilter("status", value)}
                options={[
                  { value: "", label: t("labels.all") },
                  { value: "valid", label: t("import.validRows") },
                  { value: "invalid", label: t("import.invalidRows") }
                ]}
              />
            </TableToolbar>

            <div className="max-h-80 overflow-auto rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="border-b bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-start font-semibold text-slate-600">{t("import.row")}</th>
                    {Object.keys(previewRowsQuery.data?.items[0]?.data ?? {}).map((k) => (
                      <th key={k} className="px-3 py-2 text-start font-semibold text-slate-600">{k}</th>
                    ))}
                    <th className="px-3 py-2 text-start font-semibold text-slate-600">{t("import.status")}</th>
                  </tr>
                </thead>
                <tbody>
                  {(previewRowsQuery.data?.items ?? []).map((row) => (
                    <tr key={row.rowNumber} className={row.errors.length ? "bg-red-50" : ""}>
                      <td className="px-3 py-1.5 text-slate-400">{row.rowNumber}</td>
                      {Object.values(row.data).map((v, i) => (
                        <td key={i} className="px-3 py-1.5">{v}</td>
                      ))}
                      <td className="px-3 py-1.5">
                        {row.errors.length ? (
                          <span className="text-red-600">{row.errors.join("; ")}</span>
                        ) : (
                          <CheckCircle2 className="size-4 text-green-500" />
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <TablePagination
              page={table.state.page}
              pageSize={table.state.limit}
              total={previewRowsQuery.data?.total ?? 0}
              onPageChange={table.setPage}
              onPageSizeChange={table.setLimit}
            />

            <div className="flex gap-3">
              <PrimaryButton disabled={preview.valid === 0 || loading} onClick={handleExecute}>
                {loading ? <Loader2 className="size-4 animate-spin" /> : null}
                {t("import.import", { count: preview.valid })}
              </PrimaryButton>
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm" onClick={reset}>
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        </SectionCard>
      )}

      {/* Step 3: Results */}
      {step === "results" && result && (
        <SectionCard title={t("import.resultsTitle")}>
          <div className="space-y-4">
            <div className="flex gap-4 text-sm">
              <div className="flex items-center gap-2 rounded-xl bg-green-50 px-4 py-2 text-green-700">
                <CheckCircle2 className="size-4" />
                <span className="font-semibold">{result.imported}</span> {t("import.imported")}
              </div>
              <div className="flex items-center gap-2 rounded-xl bg-red-50 px-4 py-2 text-red-700">
                <XCircle className="size-4" />
                <span className="font-semibold">{result.failed}</span> {t("import.failed")}
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-slate-600">{t("import.failedRows")}</p>
                  <button
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-500 hover:text-accent"
                    onClick={() => downloadErrorReport(result.errors)}
                  >
                    <Download className="size-3" />
                    {t("import.downloadErrors")}
                  </button>
                </div>
                <div className="max-h-40 overflow-auto rounded-2xl border border-red-100 bg-red-50">
                  {result.errors.map((e) => (
                    <div key={e.rowNumber} className="border-b border-red-100 px-4 py-2 text-sm last:border-0">
                      <span className="font-medium text-red-600">{t("import.row")} {e.rowNumber}:</span>{" "}
                      <span className="text-red-500">{e.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <PrimaryButton onClick={reset}>{t("import.importMore")}</PrimaryButton>
          </div>
        </SectionCard>
      )}
    </div>
  );
}
