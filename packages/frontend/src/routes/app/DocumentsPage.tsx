import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useTableQueryState } from "../../lib/tableQueryState";
import { apiFetch, apiFormFetch } from "../../lib/api";
import { getDocumentIoCapability, listDesktopScanners, scanDocument } from "../../lib/desktopDocumentIo";
import { useHasPermission } from "../../store/authStore";
import {
  ErrorState,
  Field,
  PageHeader,
  PrimaryButton,
  SectionCard,
  SelectField,
  TableToolbar
} from "./ui";
import { DocumentList } from "../../components/documents/DocumentList";
import { getEnumLabel } from "../../lib/enumLabel";
import { useLookupOptions } from "../../lib/lookups";
import type { DocumentDto, DesktopScanner } from "@elms/shared";
import { useToastStore } from "../../store/toastStore";

export function DocumentsPage() {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const canCreateDocuments = useHasPermission("documents:create");
  const canScanDocuments = useHasPermission("documents:scan");
  const canUseScan = canCreateDocuments && canScanDocuments;
  const [scanOpen, setScanOpen] = useState(false);
  const [scanTitle, setScanTitle] = useState("");
  const [scanType, setScanType] = useState("GENERAL");
  const [scanCaseId, setScanCaseId] = useState("");
  const [scanClientId, setScanClientId] = useState("");
  const [scanTaskId, setScanTaskId] = useState("");
  const [scanScannerId, setScanScannerId] = useState("");
  const [scanSource, setScanSource] = useState<"device" | "file-picker">("file-picker");
  const [scanStatus, setScanStatus] = useState<
    "queued" | "capturing" | "uploading" | "processing" | "failed" | "done"
  >("queued");
  const table = useTableQueryState({
    defaultSortBy: "createdAt",
    defaultSortDir: "desc",
    defaultLimit: 20,
    filterKeys: ["type"]
  });
  const docTypesQuery = useLookupOptions("DocumentType");
  const ioQuery = useQuery({
    queryKey: ["desktop-document-io-capability"],
    queryFn: getDocumentIoCapability
  });
  const io = ioQuery.data;
  const canDesktopScan = io?.scan.available ?? false;
  const scannersQuery = useQuery({
    queryKey: ["desktop-scanners"],
    queryFn: listDesktopScanners,
    enabled: scanOpen && canUseScan && canDesktopScan
  });

  const queryKey = [
    "documents",
    table.state.q,
    table.state.filters.type,
    table.state.sortBy,
    table.state.sortDir,
    table.state.page,
    table.state.limit
  ];

  const typeOptions = [
    { value: "", label: t("labels.all") },
    ...(docTypesQuery.data?.items ?? []).map((o) => ({
      value: o.key,
      label: getEnumLabel(t, "DocumentType", o.key)
    }))
  ];
  const scanTypeOptions = typeOptions.filter((option) => option.value);
  const scannerOptions = (scannersQuery.data ?? []).map((scanner: DesktopScanner) => ({
    value: scanner.id,
    label: scanner.name
  }));

  const scanMutation = useMutation({
    mutationFn: async () => {
      if (!canUseScan) {
        throw new Error(t("documents.scanPermissionRequired"));
      }
      if (!canDesktopScan) {
        throw new Error(io?.scan.reason || t("documents.scanDesktopOnly"));
      }
      setScanStatus("capturing");
      const scanResult = await scanDocument({
        scannerId: scanScannerId || undefined,
        format: "pdf",
        source: scanSource
      });

      setScanStatus("uploading");
      const file = new File([new Uint8Array(scanResult.bytes)], scanResult.fileName, {
        type: scanResult.mimeType
      });
      const formData = new FormData();
      formData.append("title", scanTitle.trim() || scanResult.fileName);
      formData.append("type", scanType || "GENERAL");
      if (scanCaseId.trim()) formData.append("caseId", scanCaseId.trim());
      if (scanClientId.trim()) formData.append("clientId", scanClientId.trim());
      if (scanTaskId.trim()) formData.append("taskId", scanTaskId.trim());
      formData.append("file", file);

      const created = await apiFormFetch<DocumentDto>("/api/documents", {
        method: "POST",
        body: formData
      });

      setScanStatus("processing");
      await apiFetch("/api/documents/scan-audit", {
        method: "POST",
        body: JSON.stringify({
          documentId: created.id,
          scannerId: scanResult.scannerId,
          scannerName: scanResult.scannerName,
          fileName: scanResult.fileName,
          status: "SUCCESS"
        })
      }).catch((error) => {
        // Scan upload succeeded; audit logging is non-blocking.
        console.warn("scan audit failed", error);
      });
      return created;
    },
    onSuccess: async () => {
      setScanStatus("done");
      await queryClient.invalidateQueries({ queryKey: ["documents"] });
      addToast(t("documents.scanSuccess"), "success");
      window.setTimeout(() => setScanOpen(false), 600);
    },
    onError: async (error) => {
      setScanStatus("failed");
      addToast((error as Error).message || t("errors.fallback"), "error");
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        actions={
          <>
            {canUseScan && canDesktopScan ? (
              <button
                className="rounded-2xl border border-slate-200 bg-white px-4 py-3 font-semibold text-slate-700"
                onClick={() => {
                  setScanOpen(true);
                  setScanStatus("queued");
                }}
                type="button"
              >
                {t("actions.scanToElms")}
              </button>
            ) : null}
            <Link
              className="rounded-2xl bg-accent px-4 py-3 font-semibold text-white"
              to="/app/documents/new"
            >
              {t("actions.uploadNew")}
            </Link>
          </>
        }
        description={t("documents.description")}
        eyebrow={t("documents.eyebrow")}
        title={t("documents.title")}
      />
      <SectionCard
        description={t("documents.listHelp")}
        title={t("documents.list")}
      >
        {docTypesQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={
              (docTypesQuery.error as Error)?.message ?? t("errors.fallback")
            }
            retryLabel={t("errors.reload")}
            onRetry={() => void docTypesQuery.refetch()}
          />
        ) : null}
        <TableToolbar>
          <Field
            label={t("labels.search")}
            value={table.state.q}
            onChange={table.setQ}
            placeholder={t("documents.searchPlaceholder")}
          />
          <SelectField
            label={t("documents.fileType")}
            onChange={(value) => table.setFilter("type", value)}
            options={typeOptions}
            value={table.state.filters.type ?? ""}
          />
        </TableToolbar>
        <div className="mb-4 max-w-xs">
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
            options={[
              { value: "createdAt:desc", label: `${t("labels.date")} ↓` },
              { value: "createdAt:asc", label: `${t("labels.date")} ↑` },
              { value: "title:asc", label: `${t("labels.documentTitle")} A-Z` },
              { value: "title:desc", label: `${t("labels.documentTitle")} Z-A` }
            ]}
          />
        </div>
        <DocumentList
          queryKey={queryKey}
          queryParams={{
            q: table.state.q || undefined,
            type: table.state.filters.type || undefined,
            sortBy: table.state.sortBy,
            sortDir: table.state.sortDir,
            page: table.state.page,
            limit: table.state.limit
          }}
          pagination={{
            page: table.state.page,
            pageSize: table.state.limit,
            onPageChange: table.setPage,
            onPageSizeChange: table.setLimit
          }}
        />
      </SectionCard>

      {scanOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-5 shadow-2xl">
            <h2 className="font-heading text-xl">{t("documents.scanTitle")}</h2>
            <p className="mt-1 text-sm text-slate-600">{t("documents.scanHelp")}</p>
            <div className="mt-4 space-y-3">
              <Field
                label={t("labels.title")}
                value={scanTitle}
                onChange={setScanTitle}
                placeholder={t("documents.scanTitlePlaceholder")}
              />
              <SelectField
                label={t("documents.fileType")}
                value={scanType}
                onChange={setScanType}
                options={scanTypeOptions}
              />
              <SelectField
                label={t("documents.scanSource")}
                value={scanSource}
                onChange={(value) => setScanSource(value as "device" | "file-picker")}
                options={[
                  { value: "file-picker", label: t("documents.scanSourceFilePicker") },
                  { value: "device", label: t("documents.scanSourceDevice") }
                ]}
              />
              <SelectField
                label={t("documents.scanner")}
                value={scanScannerId}
                onChange={setScanScannerId}
                options={[
                  { value: "", label: t("documents.defaultScanner") },
                  ...scannerOptions
                ]}
              />
              <Field
                label={t("labels.caseId")}
                value={scanCaseId}
                onChange={setScanCaseId}
                placeholder={t("labels.caseIdPlaceholder")}
              />
              <Field
                label={t("labels.clientId")}
                value={scanClientId}
                onChange={setScanClientId}
                placeholder={t("labels.clientIdPlaceholder")}
              />
              <Field
                label={t("labels.taskId")}
                value={scanTaskId}
                onChange={setScanTaskId}
                placeholder={t("labels.taskIdPlaceholder")}
              />
              <p className="text-xs text-slate-500">{t(`documents.scanStatus.${scanStatus}`)}</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                onClick={() => setScanOpen(false)}
                type="button"
              >
                {t("actions.cancel")}
              </button>
              <PrimaryButton
                disabled={scanMutation.isPending}
                onClick={() => {
                  void scanMutation.mutateAsync();
                }}
                type="button"
              >
                {t("actions.scanToElms")}
              </PrimaryButton>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
