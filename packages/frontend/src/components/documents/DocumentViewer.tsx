import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { DocumentDto } from "@elms/shared";
import { apiDownload, apiFetch } from "../../lib/api";
import { formatFileSaveSuccessMessage } from "../../lib/fileSaveFeedback";
import { saveBlobToDownloads } from "../../lib/desktopDownloads";
import {
  getDesktopDocumentIoDefaults,
  listDesktopPrinters,
  printBlob,
  setDesktopDocumentIoDefaults
} from "../../lib/desktopDocumentIo";
import { showErrorDialog } from "../../lib/dialog";
import { useToastStore } from "../../store/toastStore";
import { useHasPermission } from "../../store/authStore";
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
  const [isPrinting, setIsPrinting] = useState(false);
  const [printers, setPrinters] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState("");
  const canPrint = useHasPermission("documents:print");
  const isDesktopShell = import.meta.env.VITE_DESKTOP_SHELL === "true";
  const addToast = useToastStore((state) => state.addToast);
  const versionsKey = doc.versions.map((version) => version.id).join("|");
  const isDocx =
    doc.mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  const previewReady = doc.previewStatus === "READY";
  const isPreviewProcessing =
    doc.previewStatus === "PENDING" || doc.previewStatus === "PROCESSING";
  const isPreviewFailed = doc.previewStatus === "FAILED";
  const selectedPrinterName = useMemo(
    () => printers.find((item) => item.id === selectedPrinterId)?.name,
    [printers, selectedPrinterId]
  );
  const printerDetected = !isDesktopShell || printers.length > 0;

  useEffect(() => {
    if (!canPrint || !isDesktopShell) {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const [availablePrinters, defaults] = await Promise.all([
          listDesktopPrinters(),
          getDesktopDocumentIoDefaults()
        ]);
        if (cancelled) {
          return;
        }
        setPrinters(availablePrinters.map((item) => ({ id: item.id, name: item.name })));
        const initialId =
          defaults.defaultPrinterId ||
          availablePrinters.find((item) => item.isDefault)?.id ||
          "";
        setSelectedPrinterId(initialId);
      } catch {
        // Printer listing is best-effort; printing can still use system default.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPrint, isDesktopShell]);

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

  async function handlePrint() {
    if (!printerDetected) {
      showErrorDialog("No printer detected on this machine.");
      return;
    }
    try {
      setIsPrinting(true);
      const { blob, filename, contentType } = await apiDownload(
        `/api/documents/${doc.id}/stream`
      );

      await printBlob({
        blob,
        fileName: filename ?? doc.fileName,
        mimeType: contentType ?? doc.mimeType,
        printerId: selectedPrinterId || undefined
      });

      await apiFetch(`/api/documents/${doc.id}/print-audit`, {
        method: "POST",
        body: JSON.stringify({
          fileName: filename ?? doc.fileName,
          printerId: selectedPrinterId || undefined,
          printerName: selectedPrinterName,
          status: "SUCCESS"
        })
      });
      addToast(t("messages.printStarted"), "success");
    } catch (error) {
      void apiFetch(`/api/documents/${doc.id}/print-audit`, {
        method: "POST",
        body: JSON.stringify({
          fileName: doc.fileName,
          printerId: selectedPrinterId || undefined,
          printerName: selectedPrinterName,
          status: "FAILED",
          errorCode: "PRINT_FAILED"
        })
      }).catch(() => undefined);
      showErrorDialog((error as Error).message || t("errors.fallback"));
    } finally {
      setIsPrinting(false);
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
            {canPrint ? (
              <span title={!printerDetected ? "No printer detected on this machine." : undefined}>
                <button
                  className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isPrinting || !printerDetected}
                  onClick={() => {
                    void handlePrint();
                  }}
                  type="button"
                >
                  {t("actions.printDocument")}
                </button>
              </span>
            ) : null}
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
          {canPrint && isDesktopShell ? (
            <div className="max-w-sm">
              <label className="mb-1 block text-xs font-medium text-slate-600" htmlFor="printer-select">
                {t("documents.printer")}
              </label>
              <select
                id="printer-select"
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
                disabled={!printerDetected}
                value={selectedPrinterId}
                onChange={(event) => {
                  const value = event.target.value;
                  setSelectedPrinterId(value);
                  void setDesktopDocumentIoDefaults({
                    defaultPrinterId: value || null
                  }).catch(() => undefined);
                }}
              >
                <option value="">{t("documents.defaultPrinter")}</option>
                {printers.map((printer) => (
                  <option key={printer.id} value={printer.id}>
                    {printer.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          {isDocx && !previewReady ? (
            <p
              className={`text-sm ${isPreviewFailed ? "text-red-600" : "text-slate-500"}`}
            >
              {isPreviewFailed
                ? t("documents.previewFailed")
                : isPreviewProcessing
                  ? t("documents.previewLoading")
                  : t("documents.previewNotSupported")}
            </p>
          ) : (
            <FilePreview
              cacheKey={`${doc.id}:${doc.updatedAt}:${versionsKey}`}
              fallbackText={doc.contentText ?? undefined}
              fileName={
                isDocx ? doc.fileName.replace(/\.docx$/i, ".pdf") : doc.fileName
              }
              mimeType={isDocx ? "application/pdf" : doc.mimeType}
              streamUrl={
                isDocx
                  ? `/api/documents/${doc.id}/preview`
                  : `/api/documents/${doc.id}/stream`
              }
              title={doc.title}
              onDownload={() => {
                void handleDownload();
              }}
              downloadLabel={t("actions.downloadDocument")}
            />
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
