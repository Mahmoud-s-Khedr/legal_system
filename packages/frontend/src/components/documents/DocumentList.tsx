import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DocumentType, type DocumentDto, type DocumentListResponseDto } from "@elms/shared";
import { Modal } from "antd";
import { apiDownload, apiFetch } from "../../lib/api";
import { formatFileSaveSuccessMessage } from "../../lib/fileSaveFeedback";
import { saveBlobToDownloads } from "../../lib/desktopDownloads";
import { confirmAction, showErrorDialog } from "../../lib/dialog";
import { getEnumLabel } from "../../lib/enumLabel";
import {
  DataTable,
  EmptyState,
  ErrorState,
  Field,
  ResponsiveDataList,
  SelectField,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TablePagination,
  TableRow,
  TableWrapper
} from "../../routes/app/ui";
import { useToastStore } from "../../store/toastStore";
import { useAuthBootstrap } from "../../store/authStore";
import { EnumBadge } from "../shared/EnumBadge";
import { ExtractionStatusBadge } from "./ExtractionStatusBadge";
import { DocumentViewer } from "./DocumentViewer";

interface DocumentListProps {
  caseId?: string;
  clientId?: string;
  taskId?: string;
  queryKey: unknown[];
  queryParams?: Record<string, string | number | undefined>;
  pagination?: {
    page: number;
    pageSize: number;
    onPageChange: (page: number) => void;
    onPageSizeChange: (size: number) => void;
  };
}

export function canShowIndexedText(doc: DocumentDto) {
  return (
    doc.extractionStatus === "INDEXED" &&
    Boolean(doc.contentText?.trim().length)
  );
}

export function DocumentList({
  caseId,
  clientId,
  taskId,
  queryKey,
  queryParams,
  pagination
}: DocumentListProps) {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const addToast = useToastStore((state) => state.addToast);
  const permissions = useAuthBootstrap((state) => state.user?.permissions ?? []);
  const canUpdateDocuments = permissions.includes("documents:update");
  const canDeleteDocuments = permissions.includes("documents:delete");
  const [viewingDoc, setViewingDoc] = useState<DocumentDto | null>(null);
  const [showingIndexedDoc, setShowingIndexedDoc] =
    useState<DocumentDto | null>(null);
  const [editingDoc, setEditingDoc] = useState<DocumentDto | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editType, setEditType] = useState<DocumentType>(DocumentType.GENERAL);
  const [editError, setEditError] = useState<string | null>(null);

  const params = new URLSearchParams();
  if (caseId) params.set("caseId", caseId);
  if (clientId) params.set("clientId", clientId);
  if (taskId) params.set("taskId", taskId);
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
        (d) =>
          d.extractionStatus === "PENDING" ||
          d.extractionStatus === "PROCESSING"
      );
      return hasPending ? 3000 : false;
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/documents/${id}`, { method: "DELETE" }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
    }
  });

  const editMutation = useMutation({
    mutationFn: (doc: DocumentDto) =>
      apiFetch<DocumentDto>(`/api/documents/${doc.id}`, {
        method: "PUT",
        body: JSON.stringify({
          title: editTitle.trim(),
          type: editType
        })
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey });
      setEditingDoc(null);
      setEditError(null);
    },
    onError: (error: Error) => {
      setEditError(error.message || t("errors.fallback"));
    }
  });

  function startEdit(doc: DocumentDto) {
    setEditingDoc(doc);
    setEditTitle(doc.title);
    setEditType(doc.type);
    setEditError(null);
  }

  const handleDelete = async (doc: DocumentDto) => {
    if (!canDeleteDocuments) {
      return;
    }
    const approved = await confirmAction({
      title: t("actions.confirmDelete"),
      content: t("actions.deleteConfirmMessage"),
      okButtonProps: { danger: true }
    });
    if (!approved) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(doc.id);
    } catch (error) {
      addToast((error as Error)?.message ?? t("errors.fallback"), "error");
    }
  };

  const handleDownload = async (doc: DocumentDto) => {
    try {
      const { blob, filename } = await apiDownload(
        `/api/documents/${doc.id}/stream`
      );
      const savedPath = await saveBlobToDownloads(blob, filename ?? doc.fileName);
      addToast(formatFileSaveSuccessMessage(t, savedPath), "success");
    } catch {
      showErrorDialog(t("errors.fallback"));
    }
  };

  const handleCopyIndexedText = async () => {
    const text = showingIndexedDoc?.contentText?.trim();
    if (!text) {
      addToast(t("documents.indexedTextUnavailable"), "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      addToast(t("messages.indexedTextCopied"), "success");
    } catch {
      addToast(t("messages.indexedTextCopyFailed"), "error");
    }
  };

  if (docsQuery.isLoading) {
    return <p className="text-sm text-slate-500">{t("labels.loading")}</p>;
  }

  if (docsQuery.isError) {
    return (
      <ErrorState
        title={t("errors.title")}
        description={
          (docsQuery.error as Error)?.message ?? t("errors.fallback")
        }
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
      <ResponsiveDataList
        items={items}
        getItemKey={(item) => item.id}
        fields={[
          {
            key: "title",
            label: t("labels.documentTitle"),
            render: (doc) => (
              <div className="min-w-0">
                <p className="truncate font-medium">{doc.title}</p>
                <p className="text-xs text-slate-500">{doc.fileName}</p>
              </div>
            )
          },
          {
            key: "type",
            label: t("documents.fileType"),
            render: (doc) => (
              <EnumBadge enumName="DocumentType" value={doc.type} />
            )
          },
          {
            key: "status",
            label: t("labels.status"),
            render: (doc) => (
              <ExtractionStatusBadge status={doc.extractionStatus} />
            )
          }
        ]}
        actions={(doc) => (
          <>
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
            {canShowIndexedText(doc) ? (
              <button
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                onClick={() => setShowingIndexedDoc(doc)}
                type="button"
              >
                {t("actions.showIndexedText")}
              </button>
            ) : null}
            {canUpdateDocuments ? (
              <button
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                onClick={() => startEdit(doc)}
                type="button"
              >
                {t("actions.edit")}
              </button>
            ) : null}
            {canDeleteDocuments ? (
              <button
                className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                onClick={() => {
                  void handleDelete(doc);
                }}
                type="button"
                disabled={deleteMutation.isPending}
              >
                {t("actions.delete")}
              </button>
            ) : null}
          </>
        )}
      />
      <TableWrapper mobileMode="cards">
        <DataTable>
          <TableHead>
            <tr>
              <TableHeadCell>{t("labels.documentTitle")}</TableHeadCell>
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
                    {canShowIndexedText(doc) ? (
                      <button
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        onClick={() => setShowingIndexedDoc(doc)}
                        type="button"
                        aria-label={`${t("actions.showIndexedText")} ${doc.title}`}
                      >
                        {t("actions.showIndexedText")}
                      </button>
                    ) : null}
                    {canUpdateDocuments ? (
                      <button
                        className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                        onClick={() => startEdit(doc)}
                        type="button"
                        aria-label={`${t("actions.edit")} ${doc.title}`}
                      >
                        {t("actions.edit")}
                      </button>
                    ) : null}
                    {canDeleteDocuments ? (
                      <button
                        className="rounded-xl border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                        onClick={() => {
                          void handleDelete(doc);
                        }}
                        type="button"
                        aria-label={`${t("actions.delete")} ${doc.title}`}
                        title={t("actions.delete")}
                        disabled={deleteMutation.isPending}
                      >
                        ×
                      </button>
                    ) : null}
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
      <Modal
        title={t("actions.edit")}
        open={Boolean(editingDoc)}
        onCancel={() => {
          setEditingDoc(null);
          setEditError(null);
        }}
        footer={null}
        destroyOnClose
      >
        {editingDoc ? (
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (!editTitle.trim()) {
                setEditError(t("errors.fallback"));
                return;
              }
              editMutation.mutate(editingDoc);
            }}
          >
            {editError ? <ErrorState title={t("errors.title")} description={editError} /> : null}
            <Field
              label={t("labels.documentTitle")}
              value={editTitle}
              onChange={setEditTitle}
            />
            <SelectField
              label={t("documents.fileType")}
              value={editType}
              onChange={(value) => setEditType(value as DocumentType)}
              options={Object.values(DocumentType).map((type) => ({
                value: type,
                label: getEnumLabel(t, "DocumentType", type)
              }))}
            />
            <div className="flex justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                type="button"
                onClick={() => setEditingDoc(null)}
              >
                {t("actions.cancel")}
              </button>
              <button
                className="rounded-xl bg-accent px-3 py-1.5 text-xs font-medium text-white disabled:opacity-60"
                type="submit"
                disabled={editMutation.isPending || !editTitle.trim()}
              >
                {t("actions.save")}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
      <Modal
        title={
          showingIndexedDoc
            ? t("documents.indexedTextTitle", {
                title: showingIndexedDoc.title
              })
            : t("documents.indexedTextTitleFallback")
        }
        open={Boolean(showingIndexedDoc)}
        onCancel={() => setShowingIndexedDoc(null)}
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              onClick={handleCopyIndexedText}
              type="button"
            >
              {t("actions.copyText")}
            </button>
            <button
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              onClick={() => setShowingIndexedDoc(null)}
              type="button"
            >
              {t("actions.close")}
            </button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-slate-500">
          {t("documents.indexedTextDescription")}
        </p>
        <pre className="max-h-[48vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
          {showingIndexedDoc?.contentText?.trim() ||
            t("documents.indexedTextUnavailable")}
        </pre>
      </Modal>
    </>
  );
}
