/**
 * Arabic invoice PDF generation using pdfmake.
 *
 * Prerequisites:
 *   - Place Cairo-Regular.ttf and Cairo-Bold.ttf in packages/backend/assets/fonts/
 *   - These can be downloaded from https://fonts.google.com/specimen/Cairo
 *
 * The PDF is generated server-side and streamed to the client.
 */

import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { InvoiceDto } from "@elms/shared";
import type { TDocumentDefinitions } from "pdfmake/interfaces";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, "../../../../assets/fonts");

function loadFonts() {
  const regularPath = join(FONTS_DIR, "Cairo-Regular.ttf");
  const boldPath = join(FONTS_DIR, "Cairo-Bold.ttf");

  if (!existsSync(regularPath) || !existsSync(boldPath)) {
    throw new Error(
      "Cairo TTF fonts not found. Place Cairo-Regular.ttf and Cairo-Bold.ttf in packages/backend/assets/fonts/"
    );
  }

  return {
    Cairo: {
      normal: readFileSync(regularPath),
      bold: readFileSync(boldPath),
      italics: readFileSync(regularPath),
      bolditalics: readFileSync(boldPath)
    }
  };
}

export async function generateInvoicePdf(invoice: InvoiceDto, firmName: string): Promise<Buffer> {
  // Dynamic import of pdfmake to avoid issues with CommonJS/ESM boundaries
  const PdfPrinter = (await import("pdfmake")).default;
  const fonts = loadFonts();
  const printer = new PdfPrinter(fonts);

  const itemRows = invoice.items.map((item) => [
    { text: item.description, alignment: "right" as const },
    { text: String(item.quantity), alignment: "center" as const },
    { text: item.unitPrice, alignment: "left" as const },
    { text: item.total, alignment: "left" as const }
  ]);

  const docDefinition: TDocumentDefinitions = {
    defaultStyle: { font: "Cairo", fontSize: 11, alignment: "right" },
    content: [
      // Header
      { text: firmName, style: "header", alignment: "right", marginBottom: 4 },
      { text: "فاتورة", style: "title", alignment: "center", marginBottom: 16 },

      // Invoice metadata
      {
        columns: [
          { text: `رقم الفاتورة: ${invoice.invoiceNumber}`, width: "*" },
          {
            text: `تاريخ الإصدار: ${invoice.issuedAt ? new Date(invoice.issuedAt).toLocaleDateString("ar-EG") : "—"}`,
            width: "*",
            alignment: "left"
          }
        ],
        marginBottom: 4
      },
      invoice.clientName
        ? { text: `العميل: ${invoice.clientName}`, marginBottom: 4 }
        : null,
      invoice.caseTitle
        ? { text: `القضية: ${invoice.caseTitle}`, marginBottom: 16 }
        : null,

      // Items table
      {
        table: {
          headerRows: 1,
          widths: ["*", "auto", "auto", "auto"],
          body: [
            [
              { text: "البند", style: "tableHeader", alignment: "right" },
              { text: "الكمية", style: "tableHeader", alignment: "center" },
              { text: "سعر الوحدة", style: "tableHeader", alignment: "left" },
              { text: "الإجمالي", style: "tableHeader", alignment: "left" }
            ],
            ...itemRows
          ]
        },
        marginBottom: 8
      },

      // Totals
      {
        columns: [
          { width: "*", text: "" },
          {
            width: "auto",
            table: {
              body: [
                [{ text: "المجموع الفرعي", alignment: "right" }, { text: invoice.subtotalAmount, alignment: "left" }],
                [{ text: "الضريبة", alignment: "right" }, { text: invoice.taxAmount, alignment: "left" }],
                [{ text: "الخصم", alignment: "right" }, { text: invoice.discountAmount, alignment: "left" }],
                [
                  { text: "الإجمالي", alignment: "right", bold: true },
                  { text: invoice.totalAmount, alignment: "left", bold: true }
                ]
              ]
            },
            layout: "noBorders"
          }
        ],
        marginBottom: 16
      },

      // Status
      {
        text: `حالة الفاتورة: ${invoice.status}`,
        alignment: "center",
        color: invoice.status === "PAID" ? "#16a34a" : invoice.status === "VOID" ? "#dc2626" : "#1d4ed8"
      }
    ].filter(Boolean) as TDocumentDefinitions["content"],
    styles: {
      header: { fontSize: 18, bold: true },
      title: { fontSize: 16, bold: true },
      tableHeader: { bold: true, fillColor: "#f1f5f9" }
    }
  };

  return new Promise((resolve, reject) => {
    const doc = printer.createPdfKitDocument(docDefinition);
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    doc.end();
  });
}
