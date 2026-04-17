import type { AppEnv } from "../../../config/env.js";
import type { OcrExtractionContext } from "./IOcrAdapter.js";

type EmbeddedOcrEnv = Pick<
  AppEnv,
  "OCR_EMBEDDED_PDF_MAX_PAGES" | "OCR_EMBEDDED_DOCX_MAX_IMAGES" | "OCR_EMBEDDED_IMAGE_MAX_BYTES"
>;

export interface EmbeddedOcrLimits {
  pdfMaxPages: number;
  docxMaxImages: number;
  maxImageBytes: number;
}

const SUPPORTED_DOCX_MEDIA_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".tif",
  ".tiff",
  ".webp",
  ".bmp",
  ".gif",
]);

type PdfRenderTaskLike = {
  promise: Promise<void>;
};

type PdfViewportLike = {
  width: number;
  height: number;
};

type PdfPageLike = {
  getViewport: (options: { scale: number }) => PdfViewportLike;
  render: (options: {
    canvas: unknown;
    canvasContext: unknown;
    viewport: PdfViewportLike;
  }) => PdfRenderTaskLike;
  cleanup?: () => void;
};

type PdfDocumentLike = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PdfPageLike>;
};

type PdfLoadingTaskLike = {
  promise: Promise<PdfDocumentLike>;
  destroy?: () => Promise<void>;
};

type PdfJsModuleLike = {
  getDocument: (options: {
    data: Uint8Array;
    disableWorker: boolean;
    isEvalSupported: boolean;
    useSystemFonts: boolean;
  }) => PdfLoadingTaskLike;
};

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function logEmbeddedImageExtractionFailure(
  message: string,
  error: unknown,
  context?: OcrExtractionContext
): void {
  console.error(message, {
    documentId: context?.documentId ?? null,
    source: context?.source ?? null,
    errorMessage: getErrorMessage(error),
  });
}

export function resolveEmbeddedOcrLimits(
  env?: Partial<EmbeddedOcrEnv>
): EmbeddedOcrLimits {
  return {
    pdfMaxPages: env?.OCR_EMBEDDED_PDF_MAX_PAGES ?? 25,
    docxMaxImages: env?.OCR_EMBEDDED_DOCX_MAX_IMAGES ?? 30,
    maxImageBytes: env?.OCR_EMBEDDED_IMAGE_MAX_BYTES ?? 10 * 1024 * 1024,
  };
}

async function renderPdfPageToPng(page: PdfPageLike): Promise<Buffer> {
  const { createCanvas } = await import("@napi-rs/canvas");
  const viewport = page.getViewport({ scale: 2 });
  const width = Math.max(1, Math.ceil(viewport.width));
  const height = Math.max(1, Math.ceil(viewport.height));
  const canvas = createCanvas(width, height);
  const context = canvas.getContext("2d");
  await page.render({ canvas, canvasContext: context, viewport }).promise;
  page.cleanup?.();
  return canvas.toBuffer("image/png");
}

export async function extractEmbeddedPdfImageText(
  buffer: Buffer,
  limits: EmbeddedOcrLimits,
  extractImageText: (imageBuffer: Buffer) => Promise<string>,
  context?: OcrExtractionContext
): Promise<string[]> {
  try {
    const pdfjs = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as unknown as PdfJsModuleLike;
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(buffer),
      disableWorker: true,
      isEvalSupported: false,
      useSystemFonts: false,
    });
    const pdf = await loadingTask.promise;

    try {
      const pageCount = Math.min(pdf.numPages ?? 0, limits.pdfMaxPages);
      const collected: string[] = [];

      for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
        try {
          const page = await pdf.getPage(pageNumber);
          const imageBuffer = await renderPdfPageToPng(page);
          if (imageBuffer.length > limits.maxImageBytes) {
            continue;
          }
          const imageText = (await extractImageText(imageBuffer)).trim();
          if (imageText) {
            collected.push(imageText);
          }
        } catch (error) {
          logEmbeddedImageExtractionFailure(
            "[ocr:tesseract] Embedded PDF page OCR failed",
            error,
            context
          );
        }
      }

      return collected;
    } finally {
      try {
        await loadingTask.destroy?.();
      } catch (error) {
        logEmbeddedImageExtractionFailure(
          "[ocr:tesseract] Failed to destroy PDF loading task",
          error,
          context
        );
      }
    }
  } catch (error) {
    logEmbeddedImageExtractionFailure(
      "[ocr:tesseract] Embedded PDF OCR unavailable",
      error,
      context
    );
    return [];
  }
}

function isSupportedDocxMediaEntry(filename: string): boolean {
  if (!filename.startsWith("word/media/")) {
    return false;
  }
  const normalized = filename.toLowerCase();
  for (const ext of SUPPORTED_DOCX_MEDIA_EXTENSIONS) {
    if (normalized.endsWith(ext)) {
      return true;
    }
  }
  return false;
}

export async function extractEmbeddedDocxImageText(
  buffer: Buffer,
  limits: EmbeddedOcrLimits,
  extractImageText: (imageBuffer: Buffer) => Promise<string>,
  context?: OcrExtractionContext
): Promise<string[]> {
  try {
    const { default: JSZip } = await import("jszip");
    const zip = await JSZip.loadAsync(buffer);
    const imageEntries = Object.values(zip.files)
      .filter((entry) => !entry.dir && isSupportedDocxMediaEntry(entry.name))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, limits.docxMaxImages);

    const collected: string[] = [];
    for (const entry of imageEntries) {
      try {
        const imageBuffer = Buffer.from(await entry.async("uint8array"));
        if (imageBuffer.length > limits.maxImageBytes) {
          continue;
        }
        const imageText = (await extractImageText(imageBuffer)).trim();
        if (imageText) {
          collected.push(imageText);
        }
      } catch (error) {
        logEmbeddedImageExtractionFailure(
          "[ocr:tesseract] Embedded DOCX image OCR failed",
          error,
          context
        );
      }
    }

    return collected;
  } catch (error) {
    logEmbeddedImageExtractionFailure(
      "[ocr:tesseract] Embedded DOCX OCR unavailable",
      error,
      context
    );
    return [];
  }
}
