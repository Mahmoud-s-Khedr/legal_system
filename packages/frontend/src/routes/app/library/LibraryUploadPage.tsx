import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { Upload, FileText, XCircle, Loader2, CheckCircle2 } from "lucide-react";
import { apiFetch, apiFormFetch } from "../../../lib/api";
import {
  runUploadQueue,
  type UploadQueueStatus,
  type UploadQueueSummary
} from "../../../lib/uploadQueue";
import {
  EmptyState,
  ErrorState,
  Field,
  PageHeader,
  SectionCard,
  PrimaryButton,
  SelectField
} from "../ui";
import { getEnumLabel } from "../../../lib/enumLabel";

interface LibraryType {
  id: string;
  code: string;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  isActive: boolean;
}

interface CategoryNode {
  id: string;
  typeId: string | null;
  nameAr: string;
  nameEn: string;
  nameFr: string;
  children: CategoryNode[];
}

type UploadResult = { id: string; extractionStatus: string };

type SelectedLibraryFile = { id: string; file: File };

type FileUploadState = { status: UploadQueueStatus; error?: string };

function flattenCategories(
  nodes: CategoryNode[],
  locale: string,
  depth = 0
): { id: string; label: string }[] {
  const selectName = (node: CategoryNode) => {
    if (locale.startsWith("ar")) return node.nameAr;
    if (locale.startsWith("fr")) return node.nameFr;
    return node.nameEn;
  };

  return nodes.flatMap((n) => [
    { id: n.id, label: "\u00a0".repeat(depth * 2) + selectName(n) },
    ...flattenCategories(n.children, locale, depth + 1)
  ]);
}

const LEGISLATION_STATUSES = ["ACTIVE", "AMENDED", "REPEALED"];

function makeFileId() {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function LibraryUploadPage() {
  const { t, i18n } = useTranslation("app");
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<SelectedLibraryFile[]>([]);
  const [fileStates, setFileStates] = useState<Record<string, FileUploadState>>(
    {}
  );
  const [summary, setSummary] =
    useState<UploadQueueSummary<UploadResult> | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const typesQuery = useQuery({
    queryKey: ["library-types"],
    queryFn: () => apiFetch<LibraryType[]>("/api/library/types")
  });

  const activeTypes = useMemo(
    () => (typesQuery.data ?? []).filter((type) => type.isActive),
    [typesQuery.data]
  );

  const [form, setForm] = useState({
    typeId: "",
    typeCode: "LEGISLATION",
    categoryId: "",
    lawNumber: "",
    lawYear: "",
    judgmentNumber: "",
    judgmentDate: "",
    author: "",
    publishedAt: "",
    legislationStatus: "ACTIVE"
  });

  useEffect(() => {
    if (!form.typeId && activeTypes.length > 0) {
      setForm((current) => ({
        ...current,
        typeId: activeTypes[0].id,
        typeCode: activeTypes[0].code
      }));
    }
  }, [activeTypes, form.typeId]);

  const categoriesQuery = useQuery({
    enabled: Boolean(form.typeId),
    queryKey: ["library-categories", form.typeId],
    queryFn: () =>
      apiFetch<CategoryNode[]>(
        `/api/library/categories?typeId=${encodeURIComponent(form.typeId)}`
      )
  });

  const locale = i18n.resolvedLanguage ?? i18n.language ?? "en";
  const flatCategories = useMemo(
    () => flattenCategories(categoriesQuery.data ?? [], locale),
    [categoriesQuery.data, locale]
  );

  useEffect(() => {
    if (!form.categoryId) return;
    const isStillValid = flatCategories.some(
      (category) => category.id === form.categoryId
    );
    if (!isStillValid) {
      setForm((current) => ({ ...current, categoryId: "" }));
    }
  }, [flatCategories, form.categoryId]);

  const failedItems = useMemo(
    () => files.filter((entry) => fileStates[entry.id]?.status === "failed"),
    [files, fileStates]
  );

  const metadataIssues = useMemo(() => {
    const issues: string[] = [];
    if (!form.typeId) issues.push(t("library.validationTypeRequired"));
    if (form.typeCode === "LEGISLATION" && form.lawYear.trim() && Number.isNaN(Number(form.lawYear))) {
      issues.push(t("library.validationLawYearInvalid"));
    }
    return issues;
  }, [form, t]);

  const canSubmit =
    files.length > 0 &&
    !isUploading &&
    !categoriesQuery.isLoading &&
    !categoriesQuery.isError &&
    metadataIssues.length === 0;

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
    const incoming = Array.from(newFiles).map((file) => ({ id: makeFileId(), file }));
    setFiles((prev) => [...prev, ...incoming]);
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(fileId: string) {
    setFiles((prev) => prev.filter((entry) => entry.id !== fileId));
    setFileStates((prev) => {
      const copy = { ...prev };
      delete copy[fileId];
      return copy;
    });
  }

  function resetUploadFlow() {
    setFiles([]);
    setFileStates({});
    setSummary(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function uploadFiles(mode: "all" | "failed") {
    const targets =
      mode === "failed"
        ? failedItems
        : files.filter((entry) => fileStates[entry.id]?.status !== "success");
    if (!targets.length) return;

    setSummary(null);
    setIsUploading(true);

    const uploadSummary = await runUploadQueue<SelectedLibraryFile, UploadResult>({
      items: targets,
      concurrency: 3,
      upload: async (entry) => {
        const fd = new FormData();
        fd.append("file", entry.file);
        const sharedPayload = {
          typeId: form.typeId,
          type: form.typeCode,
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
          if (v) fd.append(k, v);
        });
        return apiFormFetch<UploadResult>("/api/library/documents/upload", {
          method: "POST",
          body: fd
        });
      },
      onStatusChange: (index, status, error) => {
        const target = targets[index];
        if (!target) return;
        setFileStates((prev) => ({ ...prev, [target.id]: { status, error } }));
      }
    });

    if (uploadSummary.successCount > 0) {
      void queryClient.invalidateQueries({ queryKey: ["library-documents"] });
    }

    setSummary(uploadSummary);
    if (uploadSummary.failedCount === 0) {
      resetUploadFlow();
      void navigate({ to: "/app/library" });
    }
    setIsUploading(false);
  }

  const isArabic = locale.startsWith("ar");
  const isFrench = locale.startsWith("fr");

  return (
    <div className="space-y-6">
      <PageHeader description={t("library.uploadDescription")} eyebrow={t("library.eyebrow")} title={t("library.uploadTitle")} />

      {summary && summary.successCount > 0 && !summary.failedCount ? (
        <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-3 text-green-800">
          <div className="flex items-center gap-2 font-semibold text-green-900">
            <CheckCircle2 className="size-4" />
            {t("library.uploadSuccess")}
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <PrimaryButton onClick={resetUploadFlow}>{t("actions.uploadAnother")}</PrimaryButton>
            <Link className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700" to="/app/library">{t("actions.view")}</Link>
          </div>
        </div>
      ) : null}

      <SectionCard title={t("library.uploadStep1")}>
        <div className="rounded-xl bg-accentSoft px-3 py-2 text-sm text-accent">{t("library.uploadFirmOnlyHint")}</div>
        <div className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center hover:border-accent hover:bg-accentSoft" onClick={() => fileInputRef.current?.click()}>
          <Upload className="mb-3 size-8 text-slate-400" />
          <p className="font-medium text-slate-600">{t("library.dropFiles")}</p>
          <p className="text-sm text-slate-400">{t("library.allowedTypes")}</p>
        </div>
        <input ref={fileInputRef} accept=".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff,.webp,.bmp,.gif" className="hidden" type="file" multiple onChange={(e) => appendFiles(e.target.files)} />

        {files.length > 0 ? (
          <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {files.map((entry) => {
              const state = fileStates[entry.id];
              return (
                <div key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
                  <FileText className="size-4 text-accent" />
                  <span className="font-medium text-slate-800">{entry.file.name}</span>
                  {state ? <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-xs">{getStatusLabel(state.status)}</span> : null}
                  <button type="button" className="ms-auto text-xs text-red-600" onClick={() => removeFile(entry.id)}>{t("documents.removeFile")}</button>
                  {state?.status === "failed" && state.error ? (
                    <p className="basis-full text-xs text-red-700">{state.error}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title={t("library.uploadStep2")}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <SelectField
            label={t("library.type")}
            value={form.typeId}
            onChange={(value) => {
              const found = activeTypes.find((type) => type.id === value);
              setForm((current) => ({
                ...current,
                typeId: value,
                typeCode: found?.code ?? current.typeCode,
                categoryId: ""
              }));
            }}
            options={activeTypes.map((type) => ({
              value: type.id,
              label: isArabic ? type.nameAr : isFrench ? type.nameFr : type.nameEn
            }))}
            disabled={typesQuery.isLoading || typesQuery.isError}
          />
          <SelectField
            label={t("library.category")}
            value={form.categoryId}
            onChange={(value) => setForm({ ...form, categoryId: value })}
            options={flatCategories.map((c) => ({ value: c.id, label: c.label }))}
            disabled={categoriesQuery.isLoading || categoriesQuery.isError || flatCategories.length === 0}
          />
        </div>
        {categoriesQuery.isError ? <div className="mt-3"><ErrorState title={t("errors.title")} description={(categoriesQuery.error as Error)?.message ?? t("errors.fallback")} /></div> : null}
        {categoriesQuery.isLoading ? <p className="mt-3 text-sm text-slate-500">{t("library.categoriesLoading")}</p> : null}
        {!categoriesQuery.isLoading && !categoriesQuery.isError && flatCategories.length === 0 ? <div className="mt-3"><EmptyState title={t("empty.noCategories")} description={t("library.categoriesEmptyForType")} /></div> : null}
      </SectionCard>

      <SectionCard title={t("library.uploadStep3")}>
        {form.typeCode === "LEGISLATION" ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <label className="block space-y-1"><span className="text-sm font-semibold">{t("library.lawNumber")}</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" type="text" value={form.lawNumber} onChange={(e) => setForm({ ...form, lawNumber: e.target.value })} /></label>
            <label className="block space-y-1"><span className="text-sm font-semibold">{t("library.lawYear")}</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" type="number" value={form.lawYear} onChange={(e) => setForm({ ...form, lawYear: e.target.value })} /></label>
            <SelectField
              label={t("library.legislationStatus")}
              value={form.legislationStatus}
              onChange={(value) =>
                setForm({ ...form, legislationStatus: value })
              }
              options={LEGISLATION_STATUSES.map((status) => ({
                value: status,
                label: getEnumLabel(t, "LegislationStatus", status)
              }))}
            />
          </div>
        ) : null}
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="block space-y-1"><span className="text-sm font-semibold">{t("library.author")}</span><input className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-accent" type="text" value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} /></label>
          <Field label={t("library.publishedAt")} type="date" commitMode="blur" value={form.publishedAt} onChange={(value) => setForm({ ...form, publishedAt: value })} />
        </div>
      </SectionCard>

      <SectionCard title={t("library.uploadStep4")}>
        {metadataIssues.length ? (
          <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {metadataIssues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </div>
        ) : null}
        <PrimaryButton disabled={!canSubmit} onClick={() => void uploadFiles("all")}>{isUploading ? <><Loader2 className="size-4 animate-spin" />{t("library.uploading")}</> : <><Upload className="size-4" />{t("library.upload")}</>}</PrimaryButton>
      </SectionCard>

      {summary?.failedCount ? <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-red-700"><XCircle className="size-5 shrink-0" /><span>{t("documents.someUploadsFailed")}</span></div> : null}
    </div>
  );
}
