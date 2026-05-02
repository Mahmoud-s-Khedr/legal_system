import { toPng } from "html-to-image";
import { jsPDF } from "jspdf";
import { saveBlobToDownloads } from "../../lib/desktopDownloads";

async function toPngDataUrl(el: HTMLElement) {
  return toPng(el, {
    cacheBust: true,
    pixelRatio: Math.min(window.devicePixelRatio || 1, 2),
    backgroundColor: "#ffffff"
  });
}

function dataUrlToBlob(dataUrl: string): Blob {
  const [meta, b64] = dataUrl.split(",");
  const mime = meta.match(/data:(.*);base64/)?.[1] ?? "image/png";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function exportReportGraphAsPng(container: HTMLElement, baseName: string) {
  const dataUrl = await toPngDataUrl(container);
  const blob = dataUrlToBlob(dataUrl);
  return saveBlobToDownloads(blob, `${baseName}.png`);
}

export async function exportReportGraphAsPdf(container: HTMLElement, baseName: string) {
  const dataUrl = await toPngDataUrl(container);
  const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const pad = 24;
  const imgW = pageW - pad * 2;
  const imgH = pageH - pad * 2;
  pdf.addImage(dataUrl, "PNG", pad, pad, imgW, imgH, undefined, "FAST");
  const blob = pdf.output("blob");
  return saveBlobToDownloads(blob, `${baseName}.pdf`);
}
