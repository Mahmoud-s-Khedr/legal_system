import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentDto } from "@elms/shared";
import { apiFetch } from "../../lib/api";
import { ExtractionStatusBadge } from "./ExtractionStatusBadge";
import { VersionHistory } from "./VersionHistory";
import { PdfViewer } from "./PdfViewer";
import { EnumBadge } from "../shared/EnumBadge";

interface DocumentViewerProps {
  document: DocumentDto;
  onClose: () => void;
  onVersionUploaded: () => void;
}

export function DocumentViewer({ document: doc, onClose, onVersionUploaded }: DocumentViewerProps) {
  const { t } = useTranslation("app");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ url: string; expiresAt: string | null }>(`/api/documents/${doc.id}/download`)
      .then((res) => setDownloadUrl(res.url))
      .catch(() => null);
  }, [doc.id]);

  const isPdf = doc.mimeType === "application/pdf";
  const isImage = doc.mimeType.startsWith("image/");

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
            {downloadUrl ? (
              <a
                className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                download
                href={downloadUrl}
                rel="noopener noreferrer"
                target="_blank"
              >
                {t("actions.downloadDocument")}
              </a>
            ) : null}
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
          {isPdf && downloadUrl ? (
            <PdfViewer url={downloadUrl} />
          ) : isImage && downloadUrl ? (
            <img alt={doc.title} className="max-w-full rounded-xl" src={downloadUrl} />
          ) : doc.contentText ? (
            <pre className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
              {doc.contentText}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">{t("documents.extractionPending")}</p>
          )}

          <VersionHistory document={doc} onVersionUploaded={onVersionUploaded} />
        </div>
      </div>
    </div>
  );
}
