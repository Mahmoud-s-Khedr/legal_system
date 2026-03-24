import React, { useState } from "react";
import { Link, useParams } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Pencil, Trash2, Plus, BookOpen } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { EmptyState, PageHeader, PrimaryButton, SectionCard } from "../ui";

function FieldWrap({ label, children }: { label: string; children: React.ReactNode }) {
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
  category: { id: string; nameAr: string; nameEn: string; nameFr: string } | null;
  articles: Article[];
  annotations: Annotation[];
}

export function LibraryDocumentPage() {
  const { t, i18n } = useTranslation("app");
  const isRtl = i18n.resolvedLanguage === "ar";
  const isFrench = i18n.resolvedLanguage === "fr";
  const { documentId } = useParams({ from: "/app/library/documents/$documentId" });
  const queryClient = useQueryClient();
  const [annotationBody, setAnnotationBody] = useState("");
  const [editingAnnotationId, setEditingAnnotationId] = useState<string | null>(null);
  const [editingBody, setEditingBody] = useState("");
  const [linkCaseId, setLinkCaseId] = useState("");
  const [linkNotes, setLinkNotes] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);

  const docQuery = useQuery({
    queryKey: ["library-document", documentId],
    queryFn: () => apiFetch<LibraryDocumentDetail>(`/api/library/documents/${documentId}`)
  });

  const createAnnotationMutation = useMutation({
    mutationFn: (body: string) =>
      apiFetch(`/api/library/documents/${documentId}/annotations`, {
        method: "POST",
        body: JSON.stringify({ body })
      }),
    onSuccess: () => {
      setAnnotationBody("");
      void queryClient.invalidateQueries({ queryKey: ["library-document", documentId] });
    }
  });

  const updateAnnotationMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: string }) =>
      apiFetch(`/api/library/annotations/${id}`, {
        method: "PUT",
        body: JSON.stringify({ body })
      }),
    onSuccess: () => {
      setEditingAnnotationId(null);
      void queryClient.invalidateQueries({ queryKey: ["library-document", documentId] });
    }
  });

  const deleteAnnotationMutation = useMutation({
    mutationFn: (id: string) =>
      apiFetch(`/api/library/annotations/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["library-document", documentId] });
    }
  });

  const linkToCaseMutation = useMutation({
    mutationFn: ({ caseId, notes }: { caseId: string; notes: string }) =>
      apiFetch(`/api/cases/${caseId}/legal-references`, {
        method: "POST",
        body: JSON.stringify({ documentId, notes })
      }),
    onSuccess: () => {
      setLinkCaseId("");
      setLinkNotes("");
      setShowLinkForm(false);
    }
  });

  const doc = docQuery.data;

  if (docQuery.isLoading) {
    return <p className="p-6 text-sm text-slate-500">{t("common.loading")}</p>;
  }
  if (!doc) {
    return <p className="p-6 text-sm text-red-600">{t("errors.notFound")}</p>;
  }

  const title = doc.title;
  const description = isRtl && doc.descriptionAr ? doc.descriptionAr : doc.description;

  const categoryTitle = doc.category
    ? (isRtl ? doc.category.nameAr : isFrench ? doc.category.nameFr : doc.category.nameEn)
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
            {new Date(doc.publishedAt).toLocaleDateString()}
          </span>
        )}
        {doc.status && (
          <span className="rounded-full bg-accentSoft px-3 py-1 text-accent">{doc.status}</span>
        )}
      </div>

      {/* Articles */}
      {doc.articles.length > 0 && (
        <SectionCard description={t("library.articlesHelp")} title={t("library.articles")}>
          <div className="space-y-4">
            {doc.articles.map((article) => {
              const artTitle = isRtl && article.titleAr ? article.titleAr : article.title;
              const artBody = isRtl && article.bodyAr ? article.bodyAr : article.body;
              return (
                <div className="rounded-2xl border border-slate-200 bg-white p-4" key={article.id}>
                  <p className="mb-2 text-sm font-semibold text-accent">
                    {article.number ? `${t("library.article")} ${article.number}` : ""}
                    {artTitle ? ` — ${artTitle}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">{artBody}</p>
                </div>
              );
            })}
          </div>
        </SectionCard>
      )}

      {/* PDF viewer link */}
      {doc.fileUrl && (
        <SectionCard title={t("library.file")}>
          <a
            className="inline-flex items-center gap-2 rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white"
            href={doc.fileUrl}
            rel="noreferrer"
            target="_blank"
          >
            <BookOpen aria-hidden="true" className="size-4" />
            {t("library.openFile")}
          </a>
        </SectionCard>
      )}

      {/* Annotations */}
      <SectionCard description={t("library.annotationsHelp")} title={t("library.annotations")}>
        <div className="space-y-3">
          {!doc.annotations.length ? (
            <EmptyState description={t("empty.noAnnotationsHelp")} title={t("empty.noAnnotations")} />
          ) : (
            doc.annotations.map((ann) =>
              editingAnnotationId === ann.id ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-4" key={ann.id}>
                  <textarea
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm outline-none focus:border-accent"
                    rows={3}
                    value={editingBody}
                    onChange={(e) => setEditingBody(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    <PrimaryButton
                      onClick={() => updateAnnotationMutation.mutate({ id: ann.id, body: editingBody })}
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
                <div className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4" key={ann.id}>
                  <p className="flex-1 whitespace-pre-wrap text-sm">{ann.body}</p>
                  <div className="flex shrink-0 gap-1">
                    <button
                      aria-label={t("actions.edit")}
                      className="rounded-lg p-1 text-slate-400 hover:text-accent"
                      onClick={() => { setEditingAnnotationId(ann.id); setEditingBody(ann.body); }}
                    >
                      <Pencil aria-hidden="true" className="size-4" />
                    </button>
                    <button
                      aria-label={t("actions.delete")}
                      className="rounded-lg p-1 text-slate-400 hover:text-red-500"
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
            disabled={!annotationBody.trim()}
            onClick={() => createAnnotationMutation.mutate(annotationBody.trim())}
          >
            <Plus aria-hidden="true" className="size-4" />
            {t("library.addAnnotation")}
          </PrimaryButton>
        </div>
      </SectionCard>

      {/* Link to case */}
      <SectionCard description={t("library.linkToCaseHelp")} title={t("library.linkToCase")}>
        {showLinkForm ? (
          <div className="space-y-3">
            <FieldWrap label={t("library.caseId")}>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder={t("library.caseIdPlaceholder")}
                type="text"
                value={linkCaseId}
                onChange={(e) => setLinkCaseId(e.target.value)}
              />
            </FieldWrap>
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
                disabled={!linkCaseId.trim()}
                onClick={() => linkToCaseMutation.mutate({ caseId: linkCaseId.trim(), notes: linkNotes })}
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
