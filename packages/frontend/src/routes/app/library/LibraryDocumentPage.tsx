import React, { useEffect, useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { CaseListResponseDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Pencil, Trash2, Plus, FileDown } from "lucide-react";
import { apiFetch, apiDownload } from "../../../lib/api";
import { toCaseSelectOption } from "../../../lib/caseOptions";
import { PdfViewer } from "../../../components/documents/PdfViewer";
import { DocxViewer } from "../../../components/documents/DocxViewer";
import { saveBlobToDownloads } from "../../../lib/desktopDownloads";
import { showErrorDialog } from "../../../lib/dialog";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  PrimaryButton,
  SelectField,
  SectionCard,
  formatDate
} from "../ui";

function FieldWrap({
  label,
  children
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

interface Annotation {
  id: string;
  body: string;
  userId: string;
  createdAt: string;
}

interface Article {
  id: string;
  number: string | null;
  title: string | null;
  titleAr: string | null;
  body: string;
  bodyAr: string | null;
}

interface LibraryDocumentDetail {
  id: string;
  title: string;
  type: string;
  scope: string;
  publishedAt: string | null;
  status: string | null;
  description: string | null;
  descriptionAr: string | null;
  fileUrl: string | null;
  storageKey: string | null;
  mimeType: string | null;
  category: {
    id: string;
    nameAr: string;
    nameEn: string;
    nameFr: string;
  } | null;
  articles: Article[];
  annotations: Annotation[];
}

export function LibraryDocumentPage() {
  const { t, i18n } = useTranslation("app");
  const isRtl = i18n.resolvedLanguage === "ar";
  const isFrench = i18n.resolvedLanguage === "fr";
  const { documentId } = useParams({
    from: "/app/library/documents/$documentId"
  });
  const queryClient = useQueryClient();
  const [annotationBody, setAnnotationBody] = useState("");
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(
    null
  );
  const [editingBody, setEditingBody] = useState("");
  const [linkCaseId, setLinkCaseId] = useState("");
  const [linkNotes, setLinkNotes] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [filePreviewBlob, setFilePreviewBlob] = useState<Blob | null>(null);
  const [filePreviewLoading, setFilePreviewLoading] = useState(false);
  const [filePreviewError, setFilePreviewError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const docQuery = useQuery({
    queryKey: ["library-document", documentId],
    queryFn: () =>
      apiFetch<LibraryDocumentDetail>(`/api/library/documents/${documentId}`)
  });
  const casesQuery = useQuery({
    queryKey: ["cases", "library-link"],
    queryFn: () => apiFetch<CaseListResponseDto>("/api/cases?limit=200")
  });

  useEffect(() => {
    const doc = docQuery.data;
    if (!doc?.storageKey || !doc.mimeType) {
      setFilePreviewUrl(null);
      setFilePreviewBlob(null);
      return;
    }

    const isPreviewable =
      doc.mimeType === "application/pdf" ||
      doc.mimeType.startsWith("image/") ||
      doc.mimeType ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    if (!isPreviewable) {
      setFilePreviewUrl(null);
      setFilePreviewBlob(null);
      return;
    }

    let cancelled = false;
    setFilePreviewLoading(true);
    setFilePreviewError(false);

    apiDownload(`/api/library/documents/${documentId}/stream`)
      .then(({ blob }) => {
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setFilePreviewUrl(url);
        setFilePreviewBlob(blob);
      })
      .catch(() => {
        if (!cancelled) setFilePreviewError(true);
      })
      .finally(() => {
        if (!cancelled) setFilePreviewLoading(false);
      });

    return () => {
      cancelled = true;
      setFilePreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      setFilePreviewBlob(null);
    };
  }, [docQuery.data, documentId]);

  const createAnnotationMutation = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/library/documents/${documentId}/annotations`, {
        method: "POST",
        body: JSON.stringify({ body })
      }),
    onSuccess: () => {
      setActionError(null);
      setAnnotationBody("");
      void queryClient.invalidateQueries({
        queryKey: ["library-document", documentId]
      });
    },
    onError: (error: Error) => {
      setActionError(error.message || t("errors.fallback"));
    }
  });

  const updateAnnotationMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiFetch(`/api/library/annotations/${id}`, {
        method: "PUT",
        body: JSON.stringify({ body })
      }),
    onSuccess: () => {
      setActionError(null);
      setEditingAnnotationId(null);
      void queryClient.invalidateQueries({
        queryKey: ["library-document", documentId]
      });
    },
    onError: (error: Error) => {
      setActionError(error.message || t("errors.fallback"));
    }
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/library/annotations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      setActionError(null);
      void queryClient.invalidateQueries({
        queryKey: ["library-document", documentId]
      });
    },
    onError: (error: Error) => {
      setActionError(error.message || t("errors.fallback"));
    }
  });

  const linkToCaseMutation = useMutation({
    mutationFn: ({ caseId, notes }: { caseId: string; notes: string }) =>
      apiFetch(`/api/cases/${caseId}/legal-references`, {
        method: "POST",
        body: JSON.stringify({ documentId, notes })
      }),
    onSuccess: () => {
      setActionError(null);
      setLinkCaseId("");
      setLinkNotes("");
      setShowLinkForm(false);
      void queryClient.invalidateQueries({
        queryKey: ["case-legal-refs", linkCaseId.trim()]
      });
    },
    onError: (error: Error) => {
      setActionError(error.message || t("errors.fallback"));
    }
  });

  const doc = docQuery.data;
  const caseOptions = [
    { value: "", label: t("labels.selectCase") },
    ...(casesQuery.data?.items ?? []).map((caseItem) =>
      toCaseSelectOption(t, caseItem)
    )
  ];

  async function handleDownload() {
    try {
      setIsDownloading(true);
      const { blob, filename } = await apiDownload(
        `/api/library/documents/${documentId}/stream`
      );
      await saveBlobToDownloads(
        blob,
        filename ?? doc?.title ?? `document-${documentId}`
      );
    } catch {
      showErrorDialog(t("errors.fallback"));
    } finally {
      setIsDownloading(false);
    }
  }

  if (docQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">{t("common.loading")}</p>;
  }
  if (docQuery.isError) {
    return (
      <div className="p-6">
        <ErrorState
          title={t("errors.title")}
          description={
            (docQuery.error as Error)?.message ?? t("errors.fallback")
          }
          retryLabel={t("errors.reload")}
          onRetry={() => void docQuery.refetch()}
        />
      </div>
    );
  }
  if (!doc) {
    return <p className="p-6 text-sm text-red-600">{t("errors.notFound")}</p>;
  }

  const title = doc.title;
  const description =
    isRtl && doc.descriptionAr ? doc.descriptionAr : doc.description;

  const categoryTitle = doc.category
    ? isRtl
      ? doc.category.nameAr
      : isFrench
        ? doc.category.nameFr
        : doc.category.nameEn
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        description={description ?? ""}
        eyebrow={doc.type}
        title={title}
        actions={
          <Link
            className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold"
            to="/app/library"
          >
            <ArrowLeft aria-hidden="true" className="size-4" />
            {t("actions.back")}
          </Link>
        }
      />

      {/* Meta */}
      <div className="flex flex-wrap gap-3 text-sm text-slate-600">
        {doc.category && (
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {categoryTitle}
          </span>
        )}
        {doc.publishedAt && (
          <span className="rounded-full bg-slate-100 px-3 py-1">
            {formatDate(doc.publishedAt)}
          </span>
        )}
        {doc.status && (
          <span className="rounded-full bg-accentSoft px-3 py-1 text-accent">
            {doc.status}
          </span>
        )}
      </div>

      {/* Articles */}
      {doc.articles.length > 0 && (
        <SectionCard
          description={t("library.articlesHelp")}
          title={t("library.articles")}
        >
          <div className="space-y-4">
            {doc.articles.map((article) => {
              const artTitle =
                isRtl && article.titleAr ? article.titleAr : article.title;
              const artBody =
                isRtl && article.bodyAr ? article.bodyAr : article.body;
              return (
                <div
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                  key={article.id}
                >
                  <p className="mb-2 text-sm font-semibold text-accent">
                    {article.number
                      ? `${t("library.article")} ${article.number}`
                      : ""}
                    {artTitle ? ` — ${artTitle}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
                    {artBody}
                  </p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* File preview */}
      {doc.storageKey && (
        <SectionCard title={t("library.file")}>
          <div className="space-y-3">
            {filePreviewLoading ? (
              <p className="text-sm text-slate-500">{t("documents.previewLoading")}</p>
            ) : filePreviewError ? (
              <p className="text-sm text-red-600">{t("documents.previewFailed")}</p>
            ) : doc.mimeType === "application/pdf" && filePreviewUrl ? (
              <PdfViewer url={filePreviewUrl} />
            ) : doc.mimeType ===
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document" && filePreviewBlob ? (
              <DocxViewer blob={filePreviewBlob} />
            ) : doc.mimeType?.startsWith("image/") && filePreviewUrl ? (
              <img
                alt={doc.title}
                className="max-w-full rounded-xl"
                src={filePreviewUrl}
              />
            ) : (
              <p className="text-sm text-slate-500">
                {t("documents.previewNotSupported")}
              </p>
            )}
            <button
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold hover:bg-slate-50"
              disabled={isDownloading}
              onClick={() => {
                void handleDownload();
              }}
              type="button"
            >
              <FileDown aria-hidden="true" className="size-4" />
              {t("library.downloadFile")}
            </button>
          </div>
        </SectionCard>
      )}

      {/* Annotations */}
      <SectionCard
        description={t("library.annotationsHelp")}
        title={t("library.annotations")}
      >
        {actionError ? (
          <p className="mb-3 text-sm text-red-600">{actionError}</p>
        ) : null}
        <div className="space-y-3">
          {!doc.annotations.length ? (
            <EmptyState
              description={t("empty.noAnnotationsHelp")}
              title={t("empty.noAnnotations")}
            />
          ) : (
            doc.annotations.map((ann) =>
              editingAnnotationId === ann.id ? (
                <div
                  className="rounded-2xl border border-slate-200 bg-white p-4"
                  key={ann.id}
                >
                  <textarea
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-accent"
                    rows={3}
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <PrimaryButton
                      disabled={updateAnnotationMutation.isPending}
                      onClick={() =>
                        updateAnnotationMutation.mutate({
                          id: ann.id,
                          body: editingBody
                        })
                      }
                    >
                      {t("actions.save")}
                    </PrimaryButton>
                    <button
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
                      onClick={() => setEditingAnnotationId(null)}
                    >
                      {t("actions.cancel")}
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4"
                  key={ann.id}
                >
                  <p className="flex-1 whitespace-pre-wrap text-sm">
                    {ann.body}
                  </p>
                  <div className="flex shrink-0 gap-1">
                    <button
                      aria-label={t("actions.edit")}
                      className="rounded-lg p-1 text-slate-400 hover:text-accent"
                      onClick={() => {
                        setEditingAnnotationId(ann.id);
                        setEditingBody(ann.body);
                      }}
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      aria-label={t("actions.delete")}
                      className="rounded-lg p-1 text-slate-400 hover:text-red-500"
                      disabled={deleteAnnotationMutation.isPending}
                      onClick={() => deleteAnnotationMutation.mutate(ann.id)}
                    >
                      <Trash2 aria-hidden="true" className="size-4" />
                    </button>
                  </div>
                </div>
              )
            )
          )}
        </div>

        {/* Add annotation */}
        <div className="mt-4 space-y-2">
          <textarea
            className="w-full rounded-2xl border border-slate-200 bg-white p-3 text-sm outline-none focus:border-accent"
            placeholder={t("library.annotationPlaceholder")}
            rows={3}
            value={annotationBody}
            onChange={(e) => setAnnotationBody(e.target.value)}
          />
          <PrimaryButton
            disabled={
              !annotationBody.trim() || createAnnotationMutation.isPending
            }
            onClick={() =>
              createAnnotationMutation.mutate(annotationBody.trim())
            }
          >
            <Plus aria-hidden="true" className="size-4" />
            {t("library.addAnnotation")}
          </PrimaryButton>
        </div>
      </SectionCard>

      {/* Link to case */}
      <SectionCard
        description={t("library.linkToCaseHelp")}
        title={t("library.linkToCase")}
      >
        {showLinkForm ? (
          <div className="space-y-3">
            <SelectField
              label={t("library.caseId")}
              options={caseOptions}
              value={linkCaseId}
              onChange={setLinkCaseId}
            />
            <FieldWrap label={t("library.linkNotes")}>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder={t("library.linkNotesPlaceholder")}
                type="text"
                value={linkNotes}
                onChange={(e) => setLinkNotes(e.target.value)}
              />
            </FieldWrap>
            <div className="flex gap-2">
              <PrimaryButton
                disabled={!linkCaseId.trim() || linkToCaseMutation.isPending}
                onClick={() =>
                  linkToCaseMutation.mutate({
                    caseId: linkCaseId.trim(),
                    notes: linkNotes
                  })
                }
              >
                {t("actions.link")}
              </PrimaryButton>
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm"
                onClick={() => setShowLinkForm(false)}
              >
                {t("actions.cancel")}
              </button>
            </div>
          </div>
        ) : (
          <PrimaryButton onClick={() => setShowLinkForm(true)}>
            <Plus aria-hidden="true" className="size-4" />
            {t("library.linkToCase")}
          </PrimaryButton>
        )}
      </SectionCard>
    </div>
  );
}
