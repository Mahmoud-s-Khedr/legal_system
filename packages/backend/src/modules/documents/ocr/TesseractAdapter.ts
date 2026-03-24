import type { IOcrAdapter } from "./IOcrAdapter.js";

const PDF_MIME = "application/pdf";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const MAX_CONCURRENT_IMAGE_OCR = 1;

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
  async extract(buffer: Buffer, mimeType: string): Promise<string> {
    try {
      if (mimeType === PDF_MIME) {
        return await extractPdf(buffer);
      }
      if (mimeType === DOCX_MIME) {
        return await extractDocx(buffer);
      }
      // Images: jpeg, png, tiff
      return await extractImage(buffer);
    } catch {
      return "";
    }
  }
}

async function extractPdf(buffer: Buffer): Promise<string> {
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const result = await parser.getText();
  return result.text ?? "";
}

async function extractDocx(buffer: Buffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ buffer });
  return result.value ?? "";
}

async function extractImage(buffer: Buffer): Promise<string> {
  await acquireImageExtractionSlot();

  const { createWorker } = await import("tesseract.js");
  const worker = await createWorker("ara+eng+fra");
  try {
    const { data } = await worker.recognize(buffer);
    return data.text ?? "";
  } finally {
    await worker.terminate();
    releaseImageExtractionSlot();
  }
}
