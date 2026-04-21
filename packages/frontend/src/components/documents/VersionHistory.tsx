import { useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import type { DocumentDto, DocumentVersionDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFormFetch } from "../../lib/api";
import { formatDateTime } from "../../routes/app/ui";
import { useToastStore } from "../../store/toastStore";

const ACCEPTED_TYPES = ".pdf,.docx,.jpg,.jpeg,.png,.tif,.tiff,.webp,.bmp,.gif";

interface VersionHistoryProps {
  document: DocumentDto;
  onVersionUploaded: () => void;
}

export function VersionHistory({
  document: doc,
  onVersionUploaded
}: VersionHistoryProps) {
  const { t } = useTranslation("app");
  const addToast = useToastStore((state) => state.addToast);
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFileName, setSelectedFileName] = useState<string>("");

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const file = fileRef.current?.files?.[0];
      if (!file) throw new Error(t("documents.noFileSelected"));
      const formData = new FormData();
      formData.append("file", file);
      return apiFormFetch<DocumentDto>(`/api/documents/${doc.id}/versions`, {
        method: "POST",
        body: formData
      });
    },
    onSuccess: () => {
      if (fileRef.current) fileRef.current.value = "";
      setSelectedFileName("");
      onVersionUploaded();
    }
  });

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{t("documents.versionHistory")}</h3>
      <ul className="space-y-1">
        {doc.versions.map((v: DocumentVersionDto) => (
          <li key={v.id} className="flex items-center justify-between text-sm">
            <span className="text-slate-600">
              v{v.versionNumber} — {v.fileName}
            </span>
            <span className="text-xs text-slate-400">
              {formatDateTime(v.createdAt)}
            </span>
          </li>
        ))}
      </ul>
      <div className="space-y-2 border-t border-slate-200 pt-3">
        <input
          accept={ACCEPTED_TYPES}
          className="hidden"
          ref={fileRef}
          type="file"
          onChange={(e) => setSelectedFileName(e.target.files?.[0]?.name ?? "")}
        />
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            {t("documents.chooseFile")}
          </button>
          <span className="text-xs text-slate-500">
            {selectedFileName || t("documents.noFileSelected")}
          </span>
        </div>
        <button
          className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          disabled={uploadMutation.isPending}
          onClick={() => {
            void (async () => {
              try {
                await uploadMutation.mutateAsync();
              } catch (error) {
                addToast(
                  (error as Error)?.message ?? t("errors.fallback"),
                  "error"
                );
              }
            })();
          }}
          type="button"
        >
          {uploadMutation.isPending ? "..." : t("actions.uploadVersion")}
        </button>
        {uploadMutation.isError ? (
          <p className="text-xs text-red-600">
            {(uploadMutation.error as Error)?.message ?? t("errors.fallback")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
