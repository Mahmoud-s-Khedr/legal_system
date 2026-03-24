import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { DocumentDto, DocumentListResponseDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { EmptyState } from "../../routes/app/ui";
import { EnumBadge } from "../shared/EnumBadge";
import { ExtractionStatusBadge } from "./ExtractionStatusBadge";
import { DocumentViewer } from "./DocumentViewer";

interface DocumentListProps {
  caseId?: string;
  clientId?: string;
  queryKey: string[];
}

export function DocumentList({ caseId, clientId, queryKey }: DocumentListProps) {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const [viewingDoc, setViewingDoc] = useState<DocumentDto | null>(null);

  const params = new URLSearchParams();
  if (caseId) params.set("caseId", caseId);
  if (clientId) params.set("clientId", clientId);

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
    const { url } = await apiFetch<{ url: string; expiresAt: string | null }>(
      `/api/documents/${doc.id}/download`
    );
    window.open(url, "_blank", "noopener,noreferrer");
  };

  if (docsQuery.isLoading) {
    return <p className="text-sm text-slate-500">{t("labels.none")}</p>;
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
      <ul className="space-y-2">
        {items.map((doc) => (
          <li
            key={doc.id}
            className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">{doc.title}</p>
              <p className="text-xs text-slate-500">{doc.fileName}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <EnumBadge enumName="DocumentType" value={doc.type} />
                <ExtractionStatusBadge status={doc.extractionStatus} />
              </div>
            </div>
            <div className="ms-4 flex shrink-0 gap-2">
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
                onClick={() => void deleteMutation.mutateAsync(doc.id)}
                type="button"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>

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
