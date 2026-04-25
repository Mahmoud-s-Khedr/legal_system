/**
 * Report export helpers — Excel (exceljs) and PDF (pdfmake, reuses Cairo fonts).
 *
 * Each helper accepts the raw report data arrays returned by reports.service.ts
 * and produces a Buffer for streaming to the client.
 */

import type {
  CaseStatusRow,
  CaseProfitabilityDto,
  HearingOutcomeRow,
  LawyerWorkloadRow,
  OutstandingBalanceRow,
  RevenueReportRow
} from "@elms/shared";

// ── Report column definitions ─────────────────────────────────────────────────

type Row = Record<string, string | number | null>;

interface ReportSpec {
  titleAr: string;
  titleEn: string;
  columns: Array<{ keyAr: string; keyEn: string; field: string; width?: number }>;
  rows: Row[];
}

function buildSpec(
  reportType: string,
  data: unknown
): ReportSpec {
  switch (reportType) {
    case "case-status": {
      const rows = data as CaseStatusRow[];
      return {
        titleAr: "توزيع حالات القضايا",
        titleEn: "Case Status Distribution",
        columns: [
          { keyAr: "الحالة", keyEn: "Status", field: "status", width: 30 },
          { keyAr: "العدد", keyEn: "Count", field: "count", width: 15 }
        ],
        rows: rows.map((r) => ({ status: r.status, count: r.count }))
      };
    }
    case "hearing-outcomes": {
      const rows = data as HearingOutcomeRow[];
      return {
        titleAr: "نتائج الجلسات",
        titleEn: "Hearing Outcomes",
        columns: [
          { keyAr: "النتيجة", keyEn: "Outcome", field: "outcome", width: 30 },
          { keyAr: "العدد", keyEn: "Count", field: "count", width: 15 }
        ],
        rows: rows.map((r) => ({ outcome: r.outcome ?? "—", count: r.count }))
      };
    }
    case "lawyer-workload": {
      const rows = data as LawyerWorkloadRow[];
      return {
        titleAr: "عبء عمل المحامين",
        titleEn: "Lawyer Workload",
        columns: [
          { keyAr: "المحامي", keyEn: "Lawyer", field: "fullName", width: 30 },
          { keyAr: "القضايا المفتوحة", keyEn: "Open Cases", field: "openCases", width: 18 },
          { keyAr: "المهام المفتوحة", keyEn: "Open Tasks", field: "openTasks", width: 18 },
          { keyAr: "الجلسات القادمة", keyEn: "Upcoming Hearings", field: "upcomingHearings", width: 22 }
        ],
        rows: rows.map((r) => ({
          fullName: r.fullName,
          openCases: r.openCases,
          openTasks: r.openTasks,
          upcomingHearings: r.upcomingHearings
        }))
      };
    }
    case "revenue": {
      const rows = data as RevenueReportRow[];
      return {
        titleAr: "تقرير الإيرادات",
        titleEn: "Revenue Report",
        columns: [
          { keyAr: "الشهر", keyEn: "Month", field: "month", width: 15 },
          { keyAr: "المفوتر", keyEn: "Invoiced", field: "invoiced", width: 20 },
          { keyAr: "المحصّل", keyEn: "Paid", field: "paid", width: 20 }
        ],
        rows: rows.map((r) => ({ month: r.month, invoiced: r.invoiced, paid: r.paid }))
      };
    }
    case "outstanding-balances": {
      const rows = data as OutstandingBalanceRow[];
      return {
        titleAr: "الأرصدة المتأخرة",
        titleEn: "Outstanding Balances",
        columns: [
          { keyAr: "رقم الفاتورة", keyEn: "Invoice #", field: "invoiceNumber", width: 18 },
          { keyAr: "العميل", keyEn: "Client", field: "clientName", width: 28 },
          { keyAr: "الإجمالي", keyEn: "Total", field: "totalAmount", width: 18 },
          { keyAr: "تاريخ الاستحقاق", keyEn: "Due Date", field: "dueDate", width: 18 },
          { keyAr: "أيام التأخير", keyEn: "Days Overdue", field: "daysOverdue", width: 16 }
        ],
        rows: rows.map((r) => ({
          invoiceNumber: r.invoiceNumber,
          clientName: r.clientName ?? "—",
          totalAmount: r.totalAmount,
          dueDate: r.dueDate ? r.dueDate.slice(0, 10) : "—",
          daysOverdue: r.daysOverdue
        }))
      };
    }
    case "case-profitability": {
      const dto = data as CaseProfitabilityDto;
      return {
        titleAr: "ربحية القضية",
        titleEn: "Case Profitability",
        columns: [
          { keyAr: "البند", keyEn: "Item", field: "label", width: 30 },
          { keyAr: "المبلغ", keyEn: "Amount", field: "value", width: 20 }
        ],
        rows: [
          { label: "إجمالي الفواتير / Total Billed", value: dto.totalBilled },
          { label: "إجمالي المدفوع / Total Paid", value: dto.totalPaid },
          { label: "إجمالي المصروفات / Total Expenses", value: dto.totalExpenses },
          { label: "صافي الربح / Gross Profit", value: dto.grossProfit }
        ]
      };
    }
    default:
      throw new Error(`Unknown report type: ${reportType}`);
  }
}

// ── Excel export ──────────────────────────────────────────────────────────────

export async function generateReportExcel(
  reportType: string,
  data: unknown,
  generatedAt?: string
): Promise<Buffer> {
  const { default: ExcelJS } = await import("exceljs");
  const spec = buildSpec(reportType, data);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ELMS";
  workbook.created = generatedAt ? new Date(generatedAt) : new Date();

  const sheet = workbook.addWorksheet(spec.titleEn, {
    views: [{ rightToLeft: true }]
  });

  // Title row
  sheet.mergeCells(1, 1, 1, spec.columns.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = `${spec.titleAr} — ${spec.titleEn}`;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  sheet.getRow(1).height = 30;

  // Generated-at row
  sheet.mergeCells(2, 1, 2, spec.columns.length);
  const dateCell = sheet.getCell(2, 1);
  dateCell.value = `Generated: ${generatedAt ?? new Date().toISOString().slice(0, 10)}`;
  dateCell.font = { italic: true, size: 10, color: { argb: "FF6B7280" } };
  dateCell.alignment = { horizontal: "center" };
  sheet.getRow(2).height = 18;

  // Column headers (row 3)
  const headerRow = sheet.getRow(3);
  spec.columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = `${col.keyAr} / ${col.keyEn}`;
    cell.font = { bold: true };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE2E8F0" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF94A3B8" } }
    };
    sheet.getColumn(i + 1).width = col.width ?? 20;
  });
  headerRow.height = 22;

  // Data rows (start at row 4)
  spec.rows.forEach((row, rowIdx) => {
    const sheetRow = sheet.getRow(rowIdx + 4);
    spec.columns.forEach((col, colIdx) => {
      const val = row[col.field];
      const cell = sheetRow.getCell(colIdx + 1);
      cell.value = val ?? "";
      cell.alignment = { horizontal: "center", vertical: "middle" };
    });
    sheetRow.height = 18;
  });

  // Freeze header rows
  sheet.views = [{ state: "frozen", ySplit: 3, rightToLeft: true }];

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// ── PDF export ────────────────────────────────────────────────────────────────

export async function generateReportPdf(
  reportType: string,
  data: unknown,
  generatedAt?: string
): Promise<Buffer> {
  const PdfPrinter = (await import("pdfmake")).default;
  const fontConfig = (await import("../../utils/pdfFonts.js")).resolvePdfFontConfig();
  if (fontConfig.usingFallback) {
    const detail = fontConfig.reason ? ` (${fontConfig.reason})` : "";
    console.warn(`[report-export] Using fallback PDF font '${fontConfig.defaultFont}'${detail}`);
  }
  const printer = new PdfPrinter(fontConfig.fonts);
  const spec = buildSpec(reportType, data);

  const headerRow = spec.columns.map((col) => ({
    text: `${col.keyAr}\n${col.keyEn}`,
    style: "tableHeader",
    alignment: "center" as const
  }));

  const dataRows = spec.rows.map((row) =>
    spec.columns.map((col) => ({
      text: String(row[col.field] ?? "—"),
      alignment: "center" as const
    }))
  );

  const widths = spec.columns.map((col) => (col.width ? `${col.width * 4}` : "*"));

  const docDefinition = {
    pageDirection: "RTL" as const,
    defaultStyle: { font: fontConfig.defaultFont, fontSize: 10, alignment: "right" as const },
    content: [
      {
        text: spec.titleAr,
        style: "title",
        alignment: "center" as const,
        marginBottom: 2
      },
      {
        text: spec.titleEn,
        style: "subtitle",
        alignment: "center" as const,
        marginBottom: 4
      },
      {
        text: `Generated: ${generatedAt ?? new Date().toISOString().slice(0, 10)}`,
        fontSize: 9,
        color: "#6b7280",
        alignment: "center" as const,
        marginBottom: 16
      },
      {
        table: {
          headerRows: 1,
          widths,
          body: [headerRow, ...dataRows]
        },
        layout: {
          fillColor: (rowIndex: number) =>
            rowIndex === 0 ? "#e2e8f0" : rowIndex % 2 === 0 ? "#f8fafc" : null
        }
      }
    ],
    styles: {
      title: { fontSize: 16, bold: true },
      subtitle: { fontSize: 12, color: "#374151" },
      tableHeader: { bold: true, fontSize: 9 }
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
