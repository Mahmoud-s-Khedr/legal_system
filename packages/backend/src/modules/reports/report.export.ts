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
  Language,
  LawyerWorkloadRow,
  OutstandingBalanceRow,
  RevenueReportRow
} from "@elms/shared";
import type { LitigationSheetRow } from "./reports.service.js";

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

type ExportLanguage = "ar" | "en" | "fr";

const LITIGATION_I18N: Record<
  ExportLanguage,
  {
    title: string;
    headers: {
      clientName: string;
      caseNumber: string;
      caseSubject: string;
      previousSessionDate: string;
      upcomingSessionDate: string;
      decision: string;
      notes: string;
    };
    sessionOutcome: Record<string, string>;
  }
> = {
  ar: {
    title: "تقرير الدعاوى والجلسات",
    headers: {
      clientName: "اسم الموكل",
      caseNumber: "رقم الدعوى",
      caseSubject: "موضوع الدعوى",
      previousSessionDate: "الجلسة السابقة",
      upcomingSessionDate: "جلسة القادمة",
      decision: "القرار",
      notes: "ملاحظات"
    },
    sessionOutcome: {
      POSTPONED: "تأجيل",
      DECIDED: "حكم",
      PARTIAL_RULING: "حكم جزئي",
      ADJOURNED: "إرجاء",
      EVIDENCE: "إثبات",
      EXPERT: "خبير",
      MEDIATION: "وساطة",
      PLEADING: "مرافعة",
      CANCELLED: "إلغاء"
    }
  },
  en: {
    title: "Litigation Sessions Report",
    headers: {
      clientName: "Client Name",
      caseNumber: "Case Number",
      caseSubject: "Case Subject",
      previousSessionDate: "Previous Session",
      upcomingSessionDate: "Upcoming Session",
      decision: "Decision",
      notes: "Notes"
    },
    sessionOutcome: {
      POSTPONED: "Postponed",
      DECIDED: "Decided",
      PARTIAL_RULING: "Partial Ruling",
      ADJOURNED: "Adjourned",
      EVIDENCE: "Evidence",
      EXPERT: "Expert",
      MEDIATION: "Mediation",
      PLEADING: "Pleading",
      CANCELLED: "Cancelled"
    }
  },
  fr: {
    title: "Rapport des litiges et audiences",
    headers: {
      clientName: "Nom du client",
      caseNumber: "Numéro d'affaire",
      caseSubject: "Objet de l'affaire",
      previousSessionDate: "Audience précédente",
      upcomingSessionDate: "Prochaine audience",
      decision: "Décision",
      notes: "Remarques"
    },
    sessionOutcome: {
      POSTPONED: "Reportée",
      DECIDED: "Décidée",
      PARTIAL_RULING: "Décision partielle",
      ADJOURNED: "Ajournée",
      EVIDENCE: "Preuve",
      EXPERT: "Expert",
      MEDIATION: "Médiation",
      PLEADING: "Plaidoirie",
      CANCELLED: "Annulée"
    }
  }
};

function normalizeExportLanguage(language: string | Language | undefined): ExportLanguage {
  const normalized = String(language ?? "ar").toLowerCase();
  if (normalized === "en" || normalized === "fr") {
    return normalized;
  }
  return "ar";
}

export async function generateLitigationSheetExcel(
  rows: LitigationSheetRow[],
  language: string | Language | undefined,
  generatedAt?: string
): Promise<Buffer> {
  const { default: ExcelJS } = await import("exceljs");
  const lang = normalizeExportLanguage(language);
  const i18n = LITIGATION_I18N[lang];
  const isRtl = lang === "ar";

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ELMS";
  workbook.created = generatedAt ? new Date(generatedAt) : new Date();

  const sheet = workbook.addWorksheet(i18n.title, {
    views: [{ rightToLeft: isRtl }]
  });

  const columns: Array<keyof LitigationSheetRow> = [
    "clientName",
    "caseNumber",
    "caseSubject",
    "previousSessionDate",
    "upcomingSessionDate",
    "decision",
    "notes"
  ];

  sheet.columns = [
    { width: 28 },
    { width: 18 },
    { width: 34 },
    { width: 18 },
    { width: 18 },
    { width: 18 },
    { width: 36 }
  ];

  sheet.mergeCells(1, 1, 1, columns.length);
  const titleCell = sheet.getCell(1, 1);
  titleCell.value = i18n.title;
  titleCell.font = { bold: true, size: 14, color: { argb: "FF0F172A" } };
  titleCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8CA9CC" } };
  titleCell.alignment = { horizontal: "center", vertical: "middle" };
  titleCell.border = {
    top: { style: "thin", color: { argb: "FF1F2937" } },
    left: { style: "thin", color: { argb: "FF1F2937" } },
    bottom: { style: "thin", color: { argb: "FF1F2937" } },
    right: { style: "thin", color: { argb: "FF1F2937" } }
  };
  sheet.getRow(1).height = 30;

  const headerRow = sheet.getRow(2);
  columns.forEach((field, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = i18n.headers[field];
    cell.font = { bold: true, color: { argb: "FF111827" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF8CA9CC" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF1F2937" } },
      left: { style: "thin", color: { argb: "FF1F2937" } },
      bottom: { style: "thin", color: { argb: "FF1F2937" } },
      right: { style: "thin", color: { argb: "FF1F2937" } }
    };
  });
  headerRow.height = 26;

  rows.forEach((row, idx) => {
    const sheetRow = sheet.getRow(idx + 3);
    columns.forEach((field, colIdx) => {
      const cell = sheetRow.getCell(colIdx + 1);
      const value = row[field];
      cell.value = field === "decision" ? (i18n.sessionOutcome[value] ?? value) : value;
      const horizontal = field === "caseNumber" || field.endsWith("Date") ? "center" : (isRtl ? "right" : "left");
      cell.alignment = { horizontal, vertical: "middle" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD0D0D0" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FF1F2937" } },
        left: { style: "thin", color: { argb: "FF1F2937" } },
        bottom: { style: "thin", color: { argb: "FF1F2937" } },
        right: { style: "thin", color: { argb: "FF1F2937" } }
      };
    });
    sheetRow.height = 22;
  });

  sheet.views = [{ state: "frozen", ySplit: 2, rightToLeft: isRtl }];
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
