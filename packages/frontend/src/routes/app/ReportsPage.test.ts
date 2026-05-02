import { describe, expect, it } from "vitest";
import {
  buildLitigationSheetExportMeta,
  buildReportExportMeta,
  buildReportOptions,
  buildReportSortOptions,
  pickReportSort
} from "./ReportsPage";

describe("ReportsPage helpers", () => {
  const t = (key: string) => key;

  it("builds a stable option list for supported report types", () => {
    const options = buildReportOptions(t);

    expect(options.map((option) => option.value)).toEqual([
      "case-status",
      "hearing-outcomes",
      "lawyer-workload",
      "revenue",
      "outstanding-balances",
      "earnings-losses",
      "dso-collection-lag",
      "invoice-void-trend",
      "cashflow-monthly",
      "ar-aging"
    ]);
    expect(options[0]?.label).toBe("reports.caseStatus");
  });

  it("builds sort options and picks the default per type", () => {
    const sortOptions = buildReportSortOptions(t);

    expect(pickReportSort("lawyer-workload", sortOptions)).toBe(
      "openCases:desc"
    );
    expect(sortOptions.revenue.map((item) => item.value)).toContain(
      "invoiced:desc"
    );
    expect(sortOptions["earnings-losses"].map((item) => item.value)).toContain(
      "netProfitCash:desc"
    );
    expect(sortOptions["cashflow-monthly"].map((item) => item.value)).toContain(
      "netCash:desc"
    );
  });

  it("builds export path and fallback file extension by format", () => {
    const pdfMeta = buildReportExportMeta(
      "case-status",
      "pdf",
      new URLSearchParams("dateFrom=2026-04-01&dateTo=2026-04-30")
    );
    const excelMeta = buildReportExportMeta(
      "revenue",
      "excel",
      new URLSearchParams("q=abc")
    );

    expect(pdfMeta.requestPath).toContain("/api/reports/case-status/export?");
    expect(pdfMeta.requestPath).toContain("format=pdf");
    expect(pdfMeta.fallbackFilename).toBe("report-case-status.pdf");
    expect(excelMeta.requestPath).toContain("format=excel");
    expect(excelMeta.fallbackFilename).toBe("report-revenue.xlsx");
  });

  it("builds litigation-sheet export path", () => {
    const meta = buildLitigationSheetExportMeta();
    expect(meta.requestPath).toBe("/api/reports/litigation-sheet/export");
    expect(meta.fallbackFilename).toBe("litigation-sheet.xlsx");
  });
});
