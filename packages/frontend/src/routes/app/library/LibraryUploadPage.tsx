import React, { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Upload, FileText, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { apiFetch } from "../../../lib/api";
import { Field, PageHeader, SectionCard, PrimaryButton, SelectField } from "../ui";

interface CategoryNode {
  id: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  children: CategoryNode[];
}

function flattenCategories(nodes: CategoryNode[], depth = 0): { id: string; label: string }[] {
  const locale = typeof window !== "undefined" ? document.documentElement.lang : "en";
  const selectName = (node: CategoryNode) => {
    if (locale === "ar") return node.nameAr;
    if (locale === "fr") return node.nameFr;
    return node.nameEn;
  };

  return nodes.flatMap((n) => [
    { id: n.id, label: "\u00a0".repeat(depth * 2) + selectName(n) },
    ...flattenCategories(n.children, depth + 1)
  ]);
}

const DOCUMENT_TYPES = [
  "LEGISLATION",
  "JUDGMENT",
  "PRACTICE_GUIDE",
  "ARTICLE",
  "COMMENTARY",
  "GENERAL"
];

const LEGISLATION_STATUSES = ["ACTIVE", "AMENDED", "REPEALED"];

const EMPTY_FORM = {
  title: "",
  type: "LEGISLATION",
  scope: "FIRM",
  categoryId: "",
  lawNumber: "",
  lawYear: "",
  judgmentNumber: "",
  judgmentDate: "",
  author: "",
  publishedAt: "",
  legislationStatus: "ACTIVE"
};

type UploadResult = { id: string; extractionStatus: string };

export function LibraryUploadPage() {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [result, setResult] = useState<UploadResult | null>(null);

  const categoriesQuery = useQuery({
    queryKey: ["library-categories"],
    queryFn: () => apiFetch<CategoryNode[]>("/api/library/categories")
  });

  const flatCategories = flattenCategories(categoriesQuery.data ?? []);

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!file) throw new Error(t("documents.noFileSelected"));
      const fd = new FormData();
      fd.append("file", file);
      Object.entries(form).forEach(([k, v]) => { if (v) fd.append(k, v); });
      const res = await fetch("/api/library/documents/upload", {
        method: "POST",
        body: fd,
        credentials: "include"
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ message: t("errors.fallback") }));
        throw new Error((err as { message?: string }).message ?? t("errors.fallback"));
      }
      return res.json() as Promise<UploadResult>;
    },
    onSuccess: (data) => {
      setResult(data);
      setFile(null);
      setForm(EMPTY_FORM);
      if (fileInputRef.current) fileInputRef.current.value = "";
      void queryClient.invalidateQueries({ queryKey: ["library-documents"] });
    }
  });

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("library.uploadDescription")}
        eyebrow={t("library.eyebrow")}
        title={t("library.uploadTitle")}
      />

      {result && (
        <div className="flex items-center gap-3 rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          <CheckCircle2 className="size-5 shrink-0" />
          <span>{t("library.uploadSuccess")} — {t("library.extractionPending")}</span>
          <button
            className="ms-auto rounded-lg border border-green-300 px-3 py-1 text-sm"
            onClick={() => setResult(null)}
          >
            {t("actions.uploadAnother")}
          </button>
        </div>
      )}

      {uploadMutation.isError && (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <XCircle className="size-5 shrink-0" />
          <span>{(uploadMutation.error as Error).message}</span>
        </div>
      )}

      <SectionCard title={t("library.uploadFile")}>
        {/* File picker */}
        <div className="space-y-4">
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-accent hover:bg-accentSoft"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mb-3 size-8 text-slate-400" />
            {file ? (
              <div className="flex items-center gap-2">
                <FileText className="size-4 text-accent" />
                <span className="font-medium text-accent">{file.name}</span>
                <span className="text-sm text-slate-500">({(file.size / 1024).toFixed(1)} KB)</span>
              </div>
            ) : (
              <>
                <p className="font-medium text-slate-600">{t("library.dropFile")}</p>
                <p className="text-sm text-slate-400">{t("library.allowedTypes")}</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            accept=".pdf,.docx,.jpg,.jpeg,.png,.tiff"
            className="hidden"
            type="file"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
      </SectionCard>

      <SectionCard title={t("library.documentMetadata")}>
        <div className="space-y-4">
          {/* Title row */}
          <div className="grid grid-cols-1 gap-3">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">{t("labels.title")} *</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                type="text"
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
              />
            </label>
          </div>

          {/* Type + Scope + Category */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <SelectField
              label={t("library.type")}
              value={form.type}
              onChange={(value) => setForm({ ...form, type: value })}
              options={DOCUMENT_TYPES.map((dt) => ({ value: dt, label: dt }))}
            />
            <SelectField
              label={t("library.scope")}
              value={form.scope}
              onChange={(value) => setForm({ ...form, scope: value })}
              options={[
                { value: "FIRM", label: t("library.scopeFirm") },
                { value: "SYSTEM", label: t("library.scopeSystem") }
              ]}
            />
            <SelectField
              label={t("library.category")}
              value={form.categoryId}
              onChange={(value) => setForm({ ...form, categoryId: value })}
              options={[
                { value: "", label: t("library.noCategory") },
                ...flatCategories.map((c) => ({ value: c.id, label: c.label }))
              ]}
            />
          </div>

          {/* Legislation fields */}
          {form.type === "LEGISLATION" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block space-y-1">
                <span className="text-sm font-semibold">{t("library.lawNumber")}</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                  placeholder="e.g. 84"
                  type="text"
                  value={form.lawNumber}
                  onChange={(e) => setForm({ ...form, lawNumber: e.target.value })}
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">{t("library.lawYear")}</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                  placeholder="e.g. 2002"
                  type="number"
                  value={form.lawYear}
                  onChange={(e) => setForm({ ...form, lawYear: e.target.value })}
                />
              </label>
              <SelectField
                label={t("library.legislationStatus")}
                value={form.legislationStatus}
                onChange={(value) => setForm({ ...form, legislationStatus: value })}
                options={LEGISLATION_STATUSES.map((status) => ({ value: status, label: status }))}
              />
            </div>
          )}

          {/* Judgment fields */}
          {form.type === "JUDGMENT" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-semibold">{t("library.judgmentNumber")}</span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                  type="text"
                  value={form.judgmentNumber}
                  onChange={(e) => setForm({ ...form, judgmentNumber: e.target.value })}
                />
              </label>
              <Field
                label={t("library.judgmentDate")}
                type="date"
                commitMode="blur"
                value={form.judgmentDate}
                onChange={(value) => setForm({ ...form, judgmentDate: value })}
              />
            </div>
          )}

          {/* Author / Published */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">{t("library.author")}</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                type="text"
                value={form.author}
                onChange={(e) => setForm({ ...form, author: e.target.value })}
              />
            </label>
            <Field
              label={t("library.publishedAt")}
              type="date"
              commitMode="blur"
              value={form.publishedAt}
              onChange={(value) => setForm({ ...form, publishedAt: value })}
            />
          </div>

          <PrimaryButton
            disabled={!file || !form.title.trim() || uploadMutation.isPending}
            onClick={() => uploadMutation.mutate()}
          >
            {uploadMutation.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                {t("library.uploading")}
              </>
            ) : (
              <>
                <Upload className="size-4" />
                {t("library.upload")}
              </>
            )}
          </PrimaryButton>
        </div>
      </SectionCard>
    </div>
  );
}
