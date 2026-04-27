import { useNavigate, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { DocumentDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { DocumentViewer } from "../../components/documents/DocumentViewer";
import { ErrorState } from "./ui";

export function DocumentDetailPage() {
  const { t } = useTranslation("app");
  const navigate = useNavigate();
  const { documentId } = useParams({ from: "/app/documents/$documentId" });

  const documentQuery = useQuery({
    queryKey: ["document", documentId],
    queryFn: () => apiFetch<DocumentDto>(`/api/documents/${documentId}`)
  });

  if (documentQuery.isLoading) {
    return <p className="p-8 text-sm text-slate-500">{t("common.loading")}</p>;
  }

  if (documentQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title={t("errors.title")}
          description={
            (documentQuery.error as Error)?.message ?? t("errors.fallback")
          }
          retryLabel={t("errors.reload")}
          onRetry={() => void documentQuery.refetch()}
        />
      </div>
    );
  }

  const document = documentQuery.data;
  if (!document) {
    return null;
  }

  return (
    <DocumentViewer
      document={document}
      onClose={() => void navigate({ to: "/app/documents" })}
      onVersionUploaded={() => void documentQuery.refetch()}
    />
  );
}