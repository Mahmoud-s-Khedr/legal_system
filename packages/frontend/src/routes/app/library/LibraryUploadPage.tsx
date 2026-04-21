import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LibraryDocumentType } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { Upload, FileText, XCircle, Loader2 } from "lucide-react";
import { apiFetch, apiFormFetch } from "../../../lib/api";
import {
  runUploadQueue,
  type UploadQueueStatus,
  type UploadQueueSummary
} from "../../../lib/uploadQueue";
import { useHasPermission } from "../../../store/authStore";
import {
  Field,
  PageHeader,
  SectionCard,
  PrimaryButton,
  SelectField
} from "../ui";

interface CategoryNode {
  id: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  children: CategoryNode[];
}

type UploadResult = { id: string; extractionStatus: string };

type SelectedLibraryFile = {
  id: string;
  file: File;
};

type FileUploadState = {
  status: UploadQueueStatus;
  error?: string;
};

function flattenCategories(
  nodes: CategoryNode[],
  depth = 0
): { id: string; label: string }[] {
  const locale =
    typeof window !== "undefined" ? document.documentElement.lang : "en";
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

const DOCUMENT_TYPES = Object.values(LibraryDocumentType);

const LEGISLATION_STATUSES = ["ACTIVE", "AMENDED", "REPEALED"];

const EMPTY_FORM = {
  type: LibraryDocumentType.LEGISLATION,
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

function makeFileId() {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function LibraryUploadPage() {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const canManageLibrary = useHasPermission("library:manage");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<SelectedLibraryFile[]>([]);
  const [fileStates, setFileStates] = useState<Record<string, FileUploadState>>(
    {}
  );
  const [form, setForm] = useState(EMPTY_FORM);
  const [summary, setSummary] =
    useState<UploadQueueSummary<UploadResult> | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const categoriesQuery = useQuery({
    queryKey: ["library-categories"],
    queryFn: () => apiFetch<CategoryNode[]>("/api/library/categories")
  });

  const flatCategories = flattenCategories(categoriesQuery.data ?? []);

  const failedItems = useMemo(
    () => files.filter((entry) => fileStates[entry.id]?.status === "failed"),
    [files, fileStates]
  );

  useEffect(() => {
    setForm((current) => {
      if (current.type === LibraryDocumentType.LEGISLATION) {
        return {
          ...current,
          judgmentNumber: "",
          judgmentDate: "",
          author: "",
          publishedAt: ""
        };
      }
      if (current.type === LibraryDocumentType.JUDGMENT) {
        return {
          ...current,
          lawNumber: "",
          lawYear: "",
          legislationStatus: "ACTIVE"
        };
      }
      return {
        ...current,
        lawNumber: "",
        lawYear: "",
        legislationStatus: "ACTIVE",
        judgmentNumber: "",
        judgmentDate: "",
        author: "",
        publishedAt: ""
      };
    });
  }, [form.type]);

  function getStatusLabel(status: UploadQueueStatus) {
    switch (status) {
      case "queued":
        return t("documents.uploadStatusQueued");
      case "uploading":
        return t("documents.uploadStatusUploading");
      case "success":
        return t("documents.uploadStatusSuccess");
      case "failed":
        return t("documents.uploadStatusFailed");
      default:
        return status;
    }
  }

  function appendFiles(newFiles: FileList | null) {
    if (!newFiles?.length) return;
    const incoming = Array.from(newFiles).map((file) => ({
      id: makeFileId(),
      file
    }));
    setFiles((prev) => [...prev, ...incoming]);
    setSummary(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function removeFile(fileId: string) {
    setFiles((prev) => prev.filter((entry) => entry.id !== fileId));
    setFileStates((prev) => {
      const copy = { ...prev };
      delete copy[fileId];
      return copy;
    });
  }

  async function uploadFiles(mode: "all" | "failed") {
    const targets =
      mode === "failed"
        ? failedItems
        : files.filter((entry) => fileStates[entry.id]?.status !== "success");

    if (!targets.length) {
      return;
    }

    const effectiveScope = canManageLibrary ? form.scope : "FIRM";

    setSummary(null);
    setIsUploading(true);

    const uploadSummary = await runUploadQueue<
      SelectedLibraryFile,
      UploadResult
    >({
      items: targets,
      concurrency: 3,
      upload: async (entry) => {
        const fd = new FormData();
        fd.append("file", entry.file);

        const sharedPayload = {
          type: form.type,
          scope: effectiveScope,
          categoryId: form.categoryId,
          lawNumber: form.lawNumber,
          lawYear: form.lawYear,
          judgmentNumber: form.judgmentNumber,
          judgmentDate: form.judgmentDate,
          author: form.author,
          publishedAt: form.publishedAt,
          legislationStatus: form.legislationStatus
        };

        Object.entries(sharedPayload).forEach(([k, v]) => {
          if (v) {
            fd.append(k, v);
          }
        });

        return apiFormFetch<UploadResult>("/api/library/documents/upload", {
          method: "POST",
          body: fd
        });
      },
      onStatusChange: (index, status, error) => {
        const target = targets[index];
        if (!target) return;
        setFileStates((prev) => ({
          ...prev,
          [target.id]: { status, error }
        }));
      }
    });

    if (uploadSummary.successCount > 0) {
      void queryClient.invalidateQueries({ queryKey: ["library-documents"] });
    }

    setSummary(uploadSummary);
    if (uploadSummary.failedCount === 0) {
      setFiles([]);
      setFileStates({});
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }

    setIsUploading(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        description={t("library.uploadDescription")}
        eyebrow={t("library.eyebrow")}
        title={t("library.uploadTitle")}
      />

      {summary && (
        <div
          className={`rounded-2xl border px-4 py-3 ${summary.failedCount > 0 ? "border-amber-200 bg-amber-50 text-amber-800" : "border-green-200 bg-green-50 text-green-800"}`}
        >
          {t("documents.uploadSummary", {
            successCount: summary.successCount,
            failedCount: summary.failedCount
          })}
        </div>
      )}

      <SectionCard title={t("library.uploadFile")}>
        <div className="space-y-4">
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-accent hover:bg-accentSoft"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mb-3 size-8 text-slate-400" />
            {files.length > 0 ? (
              <div className="space-y-1">
                <p className="font-medium text-accent">
                  {t("documents.filesSelected", { count: files.length })}
                </p>
                <p className="text-sm text-slate-500">
                  {t("library.allowedTypes")}
                </p>
              </div>
            ) : (
              <>
                <p className="font-medium text-slate-600">
                  {t("library.dropFiles")}
                </p>
                <p className="text-sm text-slate-400">
                  {t("library.allowedTypes")}
                </p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            accept=".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff,.webp,.bmp,.gif"
            className="hidden"
            type="file"
            multiple
            onChange={(e) => appendFiles(e.target.files)}
          />

          {files.length > 0 ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              {files.map((entry) => {
                const state = fileStates[entry.id];
                return (
                  <div
                    key={entry.id}
                    className="flex flex-wrap items-center gap-2 text-sm"
                  >
                    <FileText className="size-4 text-accent" />
                    <span className="font-medium text-slate-800">
                      {entry.file.name}
                    </span>
                    <span className="text-xs text-slate-500">
                      ({(entry.file.size / 1024).toFixed(1)} KB)
                    </span>
                    {state ? (
                      <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs">
                        {getStatusLabel(state.status)}
                      </span>
                    ) : null}
                    {state?.error ? (
                      <span className="text-xs text-red-600">
                        {state.error}
                      </span>
                    ) : null}
                    <button
                      type="button"
                      className="ms-auto text-xs text-red-600"
                      onClick={() => removeFile(entry.id)}
                      disabled={isUploading && state?.status === "uploading"}
                    >
                      {t("documents.removeFile")}
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard title={t("library.documentMetadata")}>
        <div className="space-y-4">
          <div
            className={`grid grid-cols-1 gap-3 ${canManageLibrary ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}
          >
            <SelectField
              label={t("library.type")}
              value={form.type}
              onChange={(value) =>
                setForm({ ...form, type: value as LibraryDocumentType })
              }
              options={DOCUMENT_TYPES.map((dt) => ({ value: dt, label: dt }))}
            />
            {canManageLibrary ? (
              <SelectField
                label={t("library.scope")}
                value={form.scope}
                onChange={(value) => setForm({ ...form, scope: value })}
                options={[
                  { value: "FIRM", label: t("library.scopeFirm") },
                  { value: "SYSTEM", label: t("library.scopeSystem") }
                ]}
              />
            ) : null}
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

          {form.type === LibraryDocumentType.LEGISLATION && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block space-y-1">
                <span className="text-sm font-semibold">
                  {t("library.lawNumber")}
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                  placeholder="e.g. 84"
                  type="text"
                  value={form.lawNumber}
                  onChange={(e) =>
                    setForm({ ...form, lawNumber: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1">
                <span className="text-sm font-semibold">
                  {t("library.lawYear")}
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                  placeholder="e.g. 2002"
                  type="number"
                  value={form.lawYear}
                  onChange={(e) =>
                    setForm({ ...form, lawYear: e.target.value })
                  }
                />
              </label>
              <SelectField
                label={t("library.legislationStatus")}
                value={form.legislationStatus}
                onChange={(value) =>
                  setForm({ ...form, legislationStatus: value })
                }
                options={LEGISLATION_STATUSES.map((status) => ({
                  value: status,
                  label: status
                }))}
              />
            </div>
          )}

          {form.type === LibraryDocumentType.JUDGMENT && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block space-y-1">
                <span className="text-sm font-semibold">
                  {t("library.judgmentNumber")}
                </span>
                <input
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent"
                  type="text"
                  value={form.judgmentNumber}
                  onChange={(e) =>
                    setForm({ ...form, judgmentNumber: e.target.value })
                  }
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

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="block space-y-1">
              <span className="text-sm font-semibold">
                {t("library.author")}
              </span>
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

          <div className="flex flex-wrap gap-2">
            <PrimaryButton
              disabled={!files.length || isUploading}
              onClick={() => void uploadFiles("all")}
            >
              {isUploading ? (
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

            {failedItems.length > 0 ? (
              <button
                type="button"
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50"
                onClick={() => void uploadFiles("failed")}
                disabled={isUploading}
              >
                {t("documents.retryFailed")}
              </button>
            ) : null}
          </div>
        </div>
      </SectionCard>

      {summary?.failedCount ? (
        <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <XCircle className="size-5 shrink-0" />
          <span>{t("documents.someUploadsFailed")}</span>
        </div>
      ) : null}
    </div>
  );
}
