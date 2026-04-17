import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import type { IOcrAdapter, OcrExtractionContext } from "./IOcrAdapter.js";
import type { AppEnv } from "../../../config/env.js";
import {
  extractEmbeddedDocxImageText,
  extractEmbeddedPdfImageText,
  resolveEmbeddedOcrLimits,
  type EmbeddedOcrLimits
} from "./EmbeddedImageOcr.js";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_CONCURRENT_IMAGE_OCR = 1;
const DEFAULT_LANGS = "ara+eng+fra";
const DEFAULT_OEM = 1;

let activeImageExtractions = 0;
const pendingImageExtractionResolvers: Array<() => void> = [];

async function acquireImageExtractionSlot(): Promise<void> {
  if (activeImageExtractions < MAX_CONCURRENT_IMAGE_OCR) {
    activeImageExtractions += 1;
    return;
  }

  await new Promise<void>((resolve) => {
    pendingImageExtractionResolvers.push(resolve);
  });
  activeImageExtractions += 1;
}

function releaseImageExtractionSlot(): void {
  activeImageExtractions = Math.max(0, activeImageExtractions - 1);
  const next = pendingImageExtractionResolvers.shift();
  if (next) {
    next();
  }
}

export class TesseractAdapter implements IOcrAdapter {
  private readonly limits: EmbeddedOcrLimits;

  constructor(env?: Partial<Pick<AppEnv, "OCR_EMBEDDED_PDF_MAX_PAGES" | "OCR_EMBEDDED_DOCX_MAX_IMAGES" | "OCR_EMBEDDED_IMAGE_MAX_BYTES">>) {
    this.limits = resolveEmbeddedOcrLimits(env);
  }

  async extract(buffer: Buffer, mimeType: string, context?: OcrExtractionContext): Promise<string> {
    try {
      if (mimeType === PDF_MIME) {
        return await extractPdf(buffer, this.limits, context);
      }
      if (mimeType === DOCX_MIME) {
        return await extractDocx(buffer, this.limits, context);
      }
      // Images: jpeg, png, tiff
      return await extractImage(buffer, context);
    } catch {
      return "";
    }
  }
}

type TesseractRuntimeOptions = {
  workerPath: string;
  corePath: string;
};

const runtimeRequire = createRequire(import.meta.url);
const resolveModulePath = (specifier: string): string => runtimeRequire.resolve(specifier);

export function resolveTesseractRuntimeOptions(
  resolver: (specifier: string) => string = resolveModulePath
): TesseractRuntimeOptions {
  const packageJsonPath = resolver("tesseract.js/package.json");
  const tesseractRoot = dirname(packageJsonPath);

  return {
    workerPath: join(tesseractRoot, "src", "worker-script", "node", "index.js"),
    corePath: resolver("tesseract.js-core/tesseract-core.wasm.js"),
  };
}

function getErrorCode(error: unknown): string | null {
  if (typeof error === "object" && error !== null && "code" in error) {
    const rawCode = (error as { code?: unknown }).code;
    return typeof rawCode === "string" ? rawCode : String(rawCode);
  }
  return null;
}

function logTesseractFailure(
  error: unknown,
  runtimeOptions: TesseractRuntimeOptions,
  context?: OcrExtractionContext
): void {
  const message = error instanceof Error ? error.message : String(error);
  console.error("[ocr:tesseract] Image extraction failed", {
    documentId: context?.documentId ?? null,
    source: context?.source ?? null,
    workerPath: runtimeOptions.workerPath,
    corePath: runtimeOptions.corePath,
    errorCode: getErrorCode(error),
    errorMessage: message,
  });
}

async function extractPdfText(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text ?? "";
}

function mergeTextBlocks(...blocks: string[]): string {
  const normalized = blocks
    .map((block) => block.trim())
    .filter((block) => block.length > 0);
  return normalized.join("\n\n");
}

async function extractPdf(
  buffer: Buffer,
  limits: EmbeddedOcrLimits,
  context?: OcrExtractionContext
): Promise<string> {
  const parserText = await extractPdfText(buffer);
  const embeddedImageTexts = await extractEmbeddedPdfImageText(
    buffer,
    limits,
    async (imageBuffer) => extractImage(imageBuffer, context),
    context
  );
  return mergeTextBlocks(parserText, ...embeddedImageTexts);
}

async function extractDocxText(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

async function extractDocx(
  buffer: Buffer,
  limits: EmbeddedOcrLimits,
  context?: OcrExtractionContext
): Promise<string> {
  const parserText = await extractDocxText(buffer);
  const embeddedImageTexts = await extractEmbeddedDocxImageText(
    buffer,
    limits,
    async (imageBuffer) => extractImage(imageBuffer, context),
    context
  );
  return mergeTextBlocks(parserText, ...embeddedImageTexts);
}

async function extractImage(buffer: Buffer, context?: OcrExtractionContext): Promise<string> {
  await acquireImageExtractionSlot();

  const runtimeOptions = resolveTesseractRuntimeOptions();
  const { createWorker } = await import("tesseract.js");
  let worker: Awaited<ReturnType<typeof createWorker>> | null = null;

  try {
    worker = await createWorker(DEFAULT_LANGS, DEFAULT_OEM, runtimeOptions);
    const { data } = await worker.recognize(buffer);
    return data.text ?? "";
  } catch (error) {
    logTesseractFailure(error, runtimeOptions, context);
    return "";
  } finally {
    if (worker) {
      try {
        await worker.terminate();
      } catch (error) {
        logTesseractFailure(error, runtimeOptions, context);
      }
    }
    releaseImageExtractionSlot();
  }
}
