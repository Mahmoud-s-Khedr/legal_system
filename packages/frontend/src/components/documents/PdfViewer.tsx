import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface PdfViewerProps {
  url: string;
}

type PdfDocumentHandle = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<{
    getViewport: (options: { scale: number }) => { width: number; height: number };
    render: (options: {
      canvasContext: CanvasRenderingContext2D;
      viewport: { width: number; height: number };
      canvas: HTMLCanvasElement;
    }) => { promise: Promise<unknown>; cancel: () => void };
  }>;
  destroy?: () => void;
};

export function PdfViewer({ url }: PdfViewerProps) {
  const { t } = useTranslation("app");
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<Map<number, HTMLElement>>(new Map());
  const canvasRefs = useRef<Map<number, HTMLCanvasElement>>(new Map());
  const renderTasksRef = useRef<Map<number, { cancel: () => void }>>(new Map());

  const [pdf, setPdf] = useState<PdfDocumentHandle | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const [renderedPages, setRenderedPages] = useState<Set<number>>(new Set());
  const [firstRenderedHeight, setFirstRenderedHeight] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    let loadingTask: { promise: Promise<PdfDocumentHandle>; destroy?: () => void } | null = null;

    setLoading(true);
    setError(null);
    setPdf(null);
    setPageCount(0);
    setCurrentPage(1);
    setPageInput("1");
    setVisiblePages(new Set());
    setRenderedPages(new Set());
    setFirstRenderedHeight(null);
    pageRefs.current.clear();
    canvasRefs.current.clear();
    renderTasksRef.current.forEach((task) => task.cancel());
    renderTasksRef.current.clear();

    async function loadPdf() {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();

        loadingTask = pdfjsLib.getDocument(url) as unknown as {
          promise: Promise<PdfDocumentHandle>;
          destroy?: () => void;
        };

        const loadedPdf = await loadingTask.promise;
        if (cancelled) return;

        const initialPages = new Set<number>();
        for (let i = 1; i <= Math.min(4, loadedPdf.numPages); i += 1) {
          initialPages.add(i);
        }

        setPdf(loadedPdf);
        setPageCount(loadedPdf.numPages);
        setVisiblePages(initialPages);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : t("documents.pdfRenderFailed"));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      loadingTask?.destroy?.();
      renderTasksRef.current.forEach((task) => task.cancel());
      renderTasksRef.current.clear();
    };
  }, [t, url]);

  const pageNumbers = useMemo(
    () => Array.from({ length: pageCount }, (_, idx) => idx + 1),
    [pageCount]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || pageCount === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const nearPages: number[] = [];
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const page = Number((entry.target as HTMLElement).dataset.page);
            if (Number.isFinite(page)) {
              nearPages.push(page);
            }
          }
        });

        if (nearPages.length > 0) {
          setVisiblePages((prev) => {
            const next = new Set(prev);
            nearPages.forEach((page) => {
              next.add(page);
              if (page > 1) next.add(page - 1);
              if (page < pageCount) next.add(page + 1);
            });
            return next;
          });
        }
      },
      {
        root: container,
        rootMargin: "1200px 0px",
        threshold: 0.01
      }
    );

    pageRefs.current.forEach((el) => observer.observe(el));

    return () => {
      observer.disconnect();
    };
  }, [pageCount, pageNumbers]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || pageCount === 0) return;

    const updateCurrentPage = () => {
      const scrollMid = container.scrollTop + container.clientHeight / 2;
      let selectedPage = 1;
      let bestDistance = Number.POSITIVE_INFINITY;

      pageRefs.current.forEach((el, page) => {
        const pageMid = el.offsetTop + el.offsetHeight / 2;
        const distance = Math.abs(pageMid - scrollMid);
        if (distance < bestDistance) {
          bestDistance = distance;
          selectedPage = page;
        }
      });

      setCurrentPage((prev) => (prev === selectedPage ? prev : selectedPage));
    };

    updateCurrentPage();
    container.addEventListener("scroll", updateCurrentPage, { passive: true });
    return () => container.removeEventListener("scroll", updateCurrentPage);
  }, [pageCount, pageNumbers]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  useEffect(() => {
    if (!pdf || visiblePages.size === 0) return;
    const pdfDoc = pdf;

    let cancelled = false;

    async function renderVisiblePages() {
      for (const pageNumber of visiblePages) {
        if (cancelled) return;
        if (renderedPages.has(pageNumber)) continue;

        const canvas = canvasRefs.current.get(pageNumber);
        if (!canvas) continue;

        try {
          const page = await pdfDoc.getPage(pageNumber);
          if (cancelled) return;

          const viewport = page.getViewport({ scale: 1.5 });
          const context = canvas.getContext("2d");
          if (!context) continue;

          canvas.width = viewport.width;
          canvas.height = viewport.height;

          const task = page.render({
            canvasContext: context,
            viewport,
            canvas
          });

          renderTasksRef.current.set(pageNumber, { cancel: task.cancel });
          await task.promise;
          renderTasksRef.current.delete(pageNumber);

          if (cancelled) return;

          setRenderedPages((prev) => {
            const next = new Set(prev);
            next.add(pageNumber);
            return next;
          });
          setFirstRenderedHeight((prev) => prev ?? viewport.height);
        } catch {
          if (!cancelled) {
            setError(t("documents.pdfRenderFailed"));
          }
        }
      }
    }

    void renderVisiblePages();

    return () => {
      cancelled = true;
    };
  }, [pdf, renderedPages, t, visiblePages]);

  const estimatedHeight = firstRenderedHeight ?? 1100;

  const setPageRef = useCallback((pageNumber: number, node: HTMLElement | null) => {
    if (node) {
      pageRefs.current.set(pageNumber, node);
      return;
    }
    pageRefs.current.delete(pageNumber);
  }, []);

  const setCanvasRef = useCallback((pageNumber: number, node: HTMLCanvasElement | null) => {
    if (node) {
      canvasRefs.current.set(pageNumber, node);
      return;
    }
    canvasRefs.current.delete(pageNumber);
  }, []);

  function jumpToPage(targetPage: number) {
    if (targetPage < 1 || targetPage > pageCount) return;
    setVisiblePages((prev) => {
      const next = new Set(prev);
      next.add(targetPage);
      if (targetPage > 1) next.add(targetPage - 1);
      if (targetPage < pageCount) next.add(targetPage + 1);
      return next;
    });

    const pageElement = pageRefs.current.get(targetPage);
    pageElement?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-3">
      {loading ? <p className="text-sm text-slate-500">{t("documents.loadingPdf")}</p> : null}
      {pageCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            className="rounded-xl border px-3 py-1 disabled:opacity-40"
            disabled={currentPage <= 1}
            onClick={() => jumpToPage(currentPage - 1)}
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
            onClick={() => jumpToPage(currentPage + 1)}
            type="button"
          >
            ›
          </button>
          <input
            aria-label={t("labels.page") ?? "Page"}
            className="w-20 rounded-xl border border-slate-300 px-2 py-1"
            inputMode="numeric"
            pattern="[0-9]*"
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value.replace(/[^0-9]/g, ""))}
          />
          <button
            className="rounded-xl border px-3 py-1"
            type="button"
            onClick={() => {
              const page = Number(pageInput);
              if (Number.isFinite(page)) {
                jumpToPage(page);
              }
            }}
          >
            {t("actions.search")}
          </button>
        </div>
      ) : null}
      <div
        className="max-h-[60vh] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-3"
        ref={containerRef}
      >
        <div className="space-y-4">
          {pageNumbers.map((pageNumber) => {
            const shouldRenderCanvas = visiblePages.has(pageNumber) || renderedPages.has(pageNumber);
            const isRendered = renderedPages.has(pageNumber);

            return (
              <section
                key={pageNumber}
                ref={(node) => setPageRef(pageNumber, node)}
                data-page={pageNumber}
                className="rounded-lg border border-slate-200 bg-white p-2"
              >
                <p className="mb-2 text-xs font-medium text-slate-500">{t("labels.page") ?? "Page"} {pageNumber}</p>
                {shouldRenderCanvas ? (
                  <canvas
                    ref={(node) => setCanvasRef(pageNumber, node)}
                    className="mx-auto w-full rounded-md border border-slate-100 bg-white"
                  />
                ) : (
                  <div
                    className="flex items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-100 text-xs text-slate-500"
                    style={{ minHeight: `${estimatedHeight}px` }}
                  >
                    {t("documents.loadingPdf")}
                  </div>
                )}
                {shouldRenderCanvas && !isRendered ? (
                  <p className="pt-2 text-xs text-slate-500">{t("documents.loadingPdf")}</p>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
