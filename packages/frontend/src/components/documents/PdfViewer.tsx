import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface PdfViewerProps {
  url: string;
}

export function PdfViewer({ url }: PdfViewerProps) {
  const { t } = useTranslation("app");
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setCurrentPage(1);
  }, [url]);

  useEffect(() => {
    let cancelled = false;
    let renderTask: { promise: Promise<unknown>; cancel: () => void } | null =
      null;

    async function render() {
      try {
        setLoading(true);
        setError(null);

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        const pdf = await pdfjsLib.getDocument(url).promise;
        if (cancelled) return;

        setPageCount(pdf.numPages);

        const page = await pdf.getPage(currentPage);
        if (cancelled) return;

        const viewport = page.getViewport({ scale: 1.5 });
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        renderTask = page.render({ canvasContext: ctx, viewport, canvas });
        await renderTask.promise;
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("documents.pdfRenderFailed")
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void render();
    return () => {
      cancelled = true;
      renderTask?.cancel();
    };
  }, [url, currentPage, t]);

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-sm text-slate-500">{t("documents.loadingPdf")}</p>
      ) : null}
      <canvas
        className="w-full rounded-xl border border-slate-200"
        ref={canvasRef}
      />
      {pageCount > 1 ? (
        <div className="flex items-center gap-3 text-sm">
          <button
            className="rounded-xl border px-3 py-1 disabled:opacity-40"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
            type="button"
          >
            ‹
          </button>
          <span>
            {currentPage} / {pageCount}
          </span>
          <button
            className="rounded-xl border px-3 py-1 disabled:opacity-40"
            disabled={currentPage >= pageCount}
            onClick={() => setCurrentPage((p) => p + 1)}
            type="button"
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}
