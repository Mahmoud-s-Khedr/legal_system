import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentDto } from "@elms/shared";
import { apiDownload } from "../../lib/api";
import { saveBlobToDownloads } from "../../lib/desktopDownloads";
import { showErrorDialog } from "../../lib/dialog";
import { ExtractionStatusBadge } from "./ExtractionStatusBadge";
import { VersionHistory } from "./VersionHistory";
import { PdfViewer } from "./PdfViewer";
import { EnumBadge } from "../shared/EnumBadge";

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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const previewObjectUrlRef = useRef<string | null>(null);

  const isPdf = doc.mimeType === "application/pdf";
  const isImage = doc.mimeType.startsWith("image/");
  const canPreviewFile = isPdf || isImage;
  const versionsKey = doc.versions.map((version) => version.id).join("|");

  useEffect(() => {
    function revokePreviewUrl() {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
    }

    let cancelled = false;
    revokePreviewUrl();
    setPreviewUrl(null);
    setPreviewError(false);

    if (!canPreviewFile) {
      setIsPreviewLoading(false);
      return () => {
        cancelled = true;
      };
    }

    async function loadPreview() {
      try {
        setIsPreviewLoading(true);
        const { blob } = await apiDownload(`/api/documents/${doc.id}/stream`);
        if (cancelled) {
          return;
        }
        const objectUrl = URL.createObjectURL(blob);
        previewObjectUrlRef.current = objectUrl;
        setPreviewUrl(objectUrl);
      } catch {
        if (!cancelled) {
          setPreviewError(true);
        }
      } finally {
        if (!cancelled) {
          setIsPreviewLoading(false);
        }
      }
    }

    void loadPreview();
    return () => {
      cancelled = true;
      revokePreviewUrl();
    };
  }, [canPreviewFile, doc.id, doc.updatedAt, versionsKey]);

  async function handleDownload() {
    try {
      setIsDownloading(true);
      const { blob, filename } = await apiDownload(
        `/api/documents/${doc.id}/stream`
      );
      await saveBlobToDownloads(blob, filename ?? doc.fileName);
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
        className="relative flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
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
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {isPreviewLoading ? (
            <p className="text-sm text-slate-500">
              {t("documents.previewLoading")}
            </p>
          ) : previewError ? (
            doc.contentText ? (
              <div className="space-y-3">
                <p className="text-sm text-red-600">
                  {t("documents.previewFailed")}
                </p>
                <pre className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
                  {doc.contentText}
                </pre>
              </div>
            ) : (
              <p className="text-sm text-red-600">
                {t("documents.previewFailed")}
              </p>
            )
          ) : isPdf && previewUrl ? (
            <PdfViewer url={previewUrl} />
          ) : isImage && previewUrl ? (
            <img
              alt={doc.title}
              className="max-w-full rounded-xl"
              src={previewUrl}
            />
          ) : doc.contentText ? (
            <pre className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {doc.contentText}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">
              {t("documents.extractionPending")}
            </p>
          )}

          <VersionHistory
            document={doc}
            onVersionUploaded={onVersionUploaded}
          />
        </div>
      </div>
    </div>
  );
}
