import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentDto } from "@elms/shared";
import { apiDownload } from "../../lib/api";
import { formatFileSaveSuccessMessage } from "../../lib/fileSaveFeedback";
import { saveBlobToDownloads } from "../../lib/desktopDownloads";
import { showErrorDialog } from "../../lib/dialog";
import { useToastStore } from "../../store/toastStore";
import { ExtractionStatusBadge } from "./ExtractionStatusBadge";
import { VersionHistory } from "./VersionHistory";
import { EnumBadge } from "../shared/EnumBadge";
import { FilePreview } from "./FilePreview";

interface DocumentViewerProps {
  document: DocumentDto;
  onClose: () => void;
  onVersionUploaded: () => void;
}

export function DocumentViewer({
  document: doc,
  onClose,
  onVersionUploaded
}: DocumentViewerProps) {
  const { t } = useTranslation("app");
  const [isDownloading, setIsDownloading] = useState(false);
  const addToast = useToastStore((state) => state.addToast);
  const versionsKey = doc.versions.map((version) => version.id).join("|");

  async function handleDownload() {
    try {
      setIsDownloading(true);
      const { blob, filename } = await apiDownload(
        `/api/documents/${doc.id}/stream`
      );
      const savedPath = await saveBlobToDownloads(blob, filename ?? doc.fileName);
      addToast(formatFileSaveSuccessMessage(t, savedPath), "success");
    } catch {
      showErrorDialog(t("errors.fallback"));
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex h-[80vh] w-[95vw] max-h-[90vh] max-w-[1200px] min-h-[420px] min-w-[320px] flex-col overflow-hidden rounded-3xl bg-white shadow-2xl md:h-[70vh] md:w-[70vw]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-slate-200 bg-white p-5">
          <div className="min-w-0">
            <p className="font-heading text-lg">{doc.title}</p>
            <p className="text-sm text-slate-500">{doc.fileName}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <EnumBadge enumName="DocumentType" value={doc.type} />
              <ExtractionStatusBadge status={doc.extractionStatus} />
            </div>
          </div>
          <div className="ms-4 flex shrink-0 gap-2">
            <button
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              disabled={isDownloading}
              onClick={() => {
                void handleDownload();
              }}
              type="button"
            >
              {t("actions.downloadDocument")}
            </button>
            <button
              className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
              onClick={onClose}
              type="button"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 space-y-5 overflow-y-auto p-5">
          <FilePreview
            cacheKey={`${doc.id}:${doc.updatedAt}:${versionsKey}`}
            fallbackText={doc.contentText ?? undefined}
            mimeType={doc.mimeType}
            streamUrl={`/api/documents/${doc.id}/stream`}
            title={doc.title}
            onDownload={() => {
              void handleDownload();
            }}
            downloadLabel={t("actions.downloadDocument")}
          />

          <VersionHistory
            document={doc}
            onVersionUploaded={onVersionUploaded}
          />
        </div>
      </div>
    </div>
  );
}
