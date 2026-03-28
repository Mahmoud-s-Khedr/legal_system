import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentDto, DocumentListResponseDto } from "@elms/shared";
import { apiDownload, apiFetch } from "../../lib/api";
import { saveBlobToDownloads } from "../../lib/desktopDownloads";
import { DataTable, EmptyState, ErrorState, TableBody, TableCell, TableHead, TableHeadCell, TablePagination, TableRow, TableWrapper } from "../../routes/app/ui";
import { EnumBadge } from "../shared/EnumBadge";
import { ExtractionStatusBadge } from "./ExtractionStatusBadge";
import { DocumentViewer } from "./DocumentViewer";

interface DocumentListProps {
  caseId?: string;
  clientId?: string;
  queryKey: unknown[];
  queryParams?: Record<string, string | number | undefined>;
  pagination?: {
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
}

export function DocumentList({ caseId, clientId, queryKey, queryParams, pagination }: DocumentListProps) {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const [viewingDoc, setViewingDoc] = useState<DocumentDto | null>(null);

  const params = new URLSearchParams();
  if (caseId) params.set("caseId", caseId);
  if (clientId) params.set("clientId", clientId);
  for (const [key, value] of Object.entries(queryParams ?? {})) {
    if (value !== undefined && String(value).trim().length > 0) {
      params.set(key, String(value));
    }
  }

  const docsQuery = useQuery({
    queryKey,
    queryFn: () =>
      apiFetch<DocumentListResponseDto>(
        `/api/documents${params.toString() ? `?${params.toString()}` : ""}`
      ),
    refetchInterval: (data) => {
      const items = data.state.data?.items ?? [];
      const hasPending = items.some(
        (d) => d.extractionStatus === "PENDING" || d.extractionStatus === "PROCESSING"
      );
      return hasPending ? 3000 : false;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiFetch(`/api/documents/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    }
  });

  const handleDownload = async (doc: DocumentDto) => {
    try {
      const { blob, filename } = await apiDownload(`/api/documents/${doc.id}/stream`);
      await saveBlobToDownloads(blob, filename ?? doc.fileName);
    } catch {
      window.alert(t("errors.fallback"));
    }
  };

  if (docsQuery.isLoading) {
    return <p className="text-sm text-slate-500">{t("labels.loading")}</p>;
  }

  if (docsQuery.isError) {
    return (
      <ErrorState
        title={t("errors.title")}
        description={(docsQuery.error as Error)?.message ?? t("errors.fallback")}
        retryLabel={t("errors.reload")}
        onRetry={() => void docsQuery.refetch()}
      />
    );
  }

  const items = docsQuery.data?.items ?? [];

  if (items.length === 0) {
    return (
      <EmptyState
        title={t("documents.noDocuments")}
        description={t("documents.noDocumentsHelp")}
      />
    );
  }

  return (
    <>
      <TableWrapper>
        <DataTable>
          <TableHead>
            <tr>
              <TableHeadCell>{t("labels.title")}</TableHeadCell>
              <TableHeadCell>{t("documents.fileType")}</TableHeadCell>
              <TableHeadCell>{t("labels.status")}</TableHeadCell>
              <TableHeadCell align="end">{t("actions.more")}</TableHeadCell>
            </tr>
          </TableHead>
          <TableBody>
            {items.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <p className="truncate font-medium">{doc.title}</p>
                  <p className="text-xs text-slate-500">{doc.fileName}</p>
                </TableCell>
                <TableCell>
                  <EnumBadge enumName="DocumentType" value={doc.type} />
                </TableCell>
                <TableCell>
                  <ExtractionStatusBadge status={doc.extractionStatus} />
                </TableCell>
                <TableCell align="end">
                  <div className="flex justify-end gap-2">
                    <button
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                      onClick={() => setViewingDoc(doc)}
                      type="button"
                    >
                      {t("actions.viewDocument")}
                    </button>
                    <button
                      className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                      onClick={() => void handleDownload(doc)}
                      type="button"
                    >
                      {t("actions.downloadDocument")}
                    </button>
                    <button
                      className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                      onClick={() => {
                        if (window.confirm(t("actions.delete"))) {
                          void deleteMutation.mutateAsync(doc.id);
                        }
                      }}
                      type="button"
                      aria-label={`${t("actions.delete")} ${doc.title}`}
                      title={t("actions.delete")}
                    >
                      ×
                    </button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </DataTable>
      </TableWrapper>
      {pagination && docsQuery.data ? (
        <TablePagination
          page={pagination.page}
          pageSize={pagination.pageSize}
          total={docsQuery.data.total}
          onPageChange={pagination.onPageChange}
          onPageSizeChange={pagination.onPageSizeChange}
        />
      ) : null}

      {viewingDoc ? (
        <DocumentViewer
          document={viewingDoc}
          onClose={() => setViewingDoc(null)}
          onVersionUploaded={async () => {
            await queryClient.invalidateQueries({ queryKey });
            setViewingDoc(null);
          }}
        />
      ) : null}
    </>
  );
}
