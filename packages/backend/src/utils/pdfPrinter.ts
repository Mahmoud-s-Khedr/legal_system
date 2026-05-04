import type PdfPrinter from "pdfmake";

type PdfMakeModule = {
  default?: typeof PdfPrinter;
};

export async function loadPdfPrinter(): Promise<typeof PdfPrinter> {
  const pdfMakeModule = (await import("pdfmake")) as PdfMakeModule | typeof PdfPrinter;
  return ("default" in pdfMakeModule && pdfMakeModule.default
    ? pdfMakeModule.default
    : pdfMakeModule) as typeof PdfPrinter;
}
