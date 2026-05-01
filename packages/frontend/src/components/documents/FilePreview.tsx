import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { apiDownload } from "../../lib/api";
import { DocxViewer } from "./DocxViewer";
import { PdfViewer } from "./PdfViewer";
import {
  FILE_PREVIEW_TIMEOUT_MS,
  resolvePreviewKind,
  resolvePreviewLimitBytes
} from "./filePreviewConfig";

export type FilePreviewState =
  | "loading"
  | "ready"
  | "unsupported"
  | "failed"
  | "too_large";

interface FilePreviewProps {
  mimeType: string;
  title: string;
  fileName?: string;
  streamUrl: string;
  cacheKey: string;
  fallbackText?: string;
  onDownload?: () => void;
  downloadLabel?: string;
}

export function FilePreview({
  mimeType,
  title,
  fileName,
  streamUrl,
  cacheKey,
  fallbackText,
  onDownload,
  downloadLabel
}: FilePreviewProps) {
  const { t } = useTranslation("app");
  const previewObjectUrlRef = useRef<string | null>(null);
  const previewBlobRef = useRef<Blob | null>(null);
  const [state, setState] = useState<FilePreviewState>("loading");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const kind = resolvePreviewKind(mimeType, fileName ?? title);

    function revokePreviewUrl() {
      if (previewObjectUrlRef.current) {
        URL.revokeObjectURL(previewObjectUrlRef.current);
        previewObjectUrlRef.current = null;
      }
      previewBlobRef.current = null;
    }

    revokePreviewUrl();
    setPreviewUrl(null);

    if (kind === "unsupported") {
      setState("unsupported");
      return () => undefined;
    }

    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), FILE_PREVIEW_TIMEOUT_MS);
    setState("loading");

    async function loadPreview() {
      try {
        const { blob, contentLength } = await apiDownload(streamUrl, {
          signal: controller.signal
        });
        if (cancelled) {
          return;
        }

        const maxBytes = resolvePreviewLimitBytes(kind);
        const measuredSize = contentLength ?? blob.size;
        if (maxBytes && measuredSize > maxBytes) {
          setState("too_large");
          return;
        }

        let previewBlob = blob;
        if (kind === "pdf" && blob.type !== "application/pdf") {
          previewBlob = new Blob([blob], { type: "application/pdf" });
        } else if (
          kind === "docx" &&
          blob.type !==
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        ) {
          previewBlob = new Blob([blob], {
            type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          });
        } else if (kind === "image" && !blob.type.startsWith("image/")) {
          previewBlob = new Blob([blob], { type: "image/*" });
        }

        const objectUrl = URL.createObjectURL(previewBlob);
        previewObjectUrlRef.current = objectUrl;
        previewBlobRef.current = previewBlob;
        setPreviewUrl(objectUrl);
        setState("ready");
      } catch {
        if (!cancelled) {
          setState("failed");
        }
      } finally {
        window.clearTimeout(timeout);
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timeout);
      revokePreviewUrl();
    };
  }, [cacheKey, fileName, mimeType, streamUrl, title]);

  const kind = resolvePreviewKind(mimeType, fileName ?? title);

  if (state === "loading") {
    return <p className="text-sm text-slate-500">{t("documents.previewLoading")}</p>;
  }

  if (state === "failed" || state === "too_large" || state === "unsupported") {
    const showFallbackText = Boolean(fallbackText && kind === "unsupported");
    return (
      <div className="space-y-3">
        <p className={state === "failed" ? "text-sm text-red-600" : "text-sm text-slate-500"}>
          {state === "failed"
            ? t("documents.previewFailed")
            : state === "too_large"
              ? t("documents.previewTooLarge")
              : t("documents.previewNotSupported")}
        </p>
        {showFallbackText ? (
          <pre className="max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700 whitespace-pre-wrap">
            {fallbackText}
          </pre>
        ) : null}
        {onDownload ? (
          <button
            className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-white hover:opacity-95"
            onClick={onDownload}
            type="button"
          >
            {downloadLabel ?? t("actions.downloadDocument")}
          </button>
        ) : null}
      </div>
    );
  }

  if (kind === "pdf" && previewBlobRef.current) {
    return <PdfViewer blob={previewBlobRef.current} />;
  }

  if (kind === "docx" && previewBlobRef.current) {
    return <DocxViewer blob={previewBlobRef.current} />;
  }

  if (kind === "image" && previewUrl) {
    return <img alt={title} className="max-w-full rounded-xl" src={previewUrl} />;
  }

  return <p className="text-sm text-slate-500">{t("documents.previewNotSupported")}</p>;
}
