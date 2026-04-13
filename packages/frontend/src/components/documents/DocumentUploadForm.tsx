import { useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { DocumentDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFormFetch } from "../../lib/api";
import { useLookupOptions } from "../../lib/lookups";
import { runUploadQueue, type UploadQueueStatus, type UploadQueueSummary } from "../../lib/uploadQueue";
import { PrimaryButton, SelectField } from "../../routes/app/ui";
import { getEnumLabel } from "../../lib/enumLabel";

const ACCEPTED_TYPES = ".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff";

type SelectedUploadFile = {
  id: string;
  file: File;
};

type FileUploadState = {
  status: UploadQueueStatus;
  error?: string;
};

interface DocumentUploadFormProps {
  caseId?: string;
  clientId?: string;
  onSuccess?: (summary: UploadQueueSummary<DocumentDto>) => void;
  invalidateKey: string[];
}

function makeFileId() {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function DocumentUploadForm({ caseId, clientId, onSuccess, invalidateKey }: DocumentUploadFormProps) {
  const { t } = useTranslation("app");
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const docTypesQuery = useLookupOptions("DocumentType");

  const [selectedFiles, setSelectedFiles] = useState<SelectedUploadFile[]>([]);
  const [fileStates, setFileStates] = useState<Record<string, FileUploadState>>({});
  const [type, setType] = useState<string>("GENERAL");
  const [error, setError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [summary, setSummary] = useState<UploadQueueSummary<DocumentDto> | null>(null);

  const typeOptions = (docTypesQuery.data?.items ?? []).map((o) => ({
    value: o.key,
    label: getEnumLabel(t, "DocumentType", o.key)
  }));
  if (!typeOptions.length) {
    typeOptions.push({ value: "GENERAL", label: getEnumLabel(t, "DocumentType", "GENERAL") });
  }

  const failedItems = useMemo(
    () => selectedFiles.filter((entry) => fileStates[entry.id]?.status === "failed"),
    [selectedFiles, fileStates]
  );

  function appendFiles(files: FileList | null) {
    if (!files?.length) return;
    const incoming = Array.from(files).map((file) => ({ id: makeFileId(), file }));
    setSelectedFiles((prev) => [...prev, ...incoming]);
    setSummary(null);
    setError(null);
    if (fileRef.current) {
      fileRef.current.value = "";
    }
  }

  function removeSelectedFile(id: string) {
    setSelectedFiles((prev) => prev.filter((entry) => entry.id !== id));
    setFileStates((prev) => {
      const copy = { ...prev };
      delete copy[id];
      return copy;
    });
  }

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

  async function uploadFiles(mode: "all" | "failed") {
    const targets =
      mode === "failed"
        ? failedItems
        : selectedFiles.filter((entry) => fileStates[entry.id]?.status !== "success");

    if (!targets.length) {
      if (!selectedFiles.length) {
        setError(t("documents.noFileSelected"));
      }
      return;
    }

    setSummary(null);
    setError(null);
    setIsUploading(true);

    const uploadSummary = await runUploadQueue<SelectedUploadFile, DocumentDto>({
      items: targets,
      concurrency: 3,
      upload: async (entry) => {
        const formData = new FormData();
        formData.append("file", entry.file);
        formData.append("title", entry.file.name);
        formData.append("type", type);
        if (caseId) formData.append("caseId", caseId);
        if (clientId) formData.append("clientId", clientId);

        return apiFormFetch<DocumentDto>("/api/documents", { method: "POST", body: formData });
      },
      onStatusChange: (index, status, uploadError) => {
        const target = targets[index];
        if (!target) return;
        setFileStates((prev) => ({
          ...prev,
          [target.id]: { status, error: uploadError }
        }));
      }
    });

    if (uploadSummary.successCount > 0) {
      await queryClient.invalidateQueries({ queryKey: invalidateKey });
    }

    setSummary(uploadSummary);
    if (uploadSummary.failedCount === 0) {
      setSelectedFiles([]);
      setFileStates({});
      if (fileRef.current) {
        fileRef.current.value = "";
      }
    }

    onSuccess?.(uploadSummary);
    setIsUploading(false);
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        void uploadFiles("all");
      }}
    >
      <div className="space-y-2">
        <p className="text-sm font-semibold">
          {t("documents.chooseFiles")}<span className="text-red-500 ms-1" aria-hidden="true">*</span>
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            {t("documents.chooseFiles")}
          </button>
          <span className="text-sm text-slate-500">
            {selectedFiles.length > 0
              ? t("documents.filesSelected", { count: selectedFiles.length })
              : t("documents.noFileSelected")}
          </span>
        </div>
        <input
          accept={ACCEPTED_TYPES}
          className="hidden"
          ref={fileRef}
          type="file"
          multiple
          onChange={(e) => appendFiles(e.target.files)}
        />
      </div>

      {selectedFiles.length > 0 ? (
        <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          {selectedFiles.map((entry) => {
            const state = fileStates[entry.id];
            return (
              <div key={entry.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-slate-800">{entry.file.name}</span>
                {state ? <span className="rounded-full bg-white px-2 py-0.5 text-xs border border-slate-200">{getStatusLabel(state.status)}</span> : null}
                {state?.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
                <button
                  type="button"
                  className="ms-auto text-xs text-red-600"
                  onClick={() => removeSelectedFile(entry.id)}
                  disabled={isUploading && state?.status === "uploading"}
                >
                  {t("documents.removeFile")}
                </button>
              </div>
            );
          })}
        </div>
      ) : null}

      <SelectField
        label={t("documents.fileType")}
        onChange={setType}
        options={typeOptions}
        value={type}
      />

      {summary ? (
        <p className={`text-sm ${summary.failedCount > 0 ? "text-amber-700" : "text-green-700"}`}>
          {t("documents.uploadSummary", {
            successCount: summary.successCount,
            failedCount: summary.failedCount
          })}
        </p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <PrimaryButton type="submit" disabled={isUploading || selectedFiles.length === 0}>
          {isUploading ? t("documents.uploadStatusUploading") : t("actions.uploadDocument")}
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
    </form>
  );
}
