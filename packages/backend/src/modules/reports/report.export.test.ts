import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

class FakeWorksheet {
  views: unknown[] = [];
  merged: Array<unknown[]> = [];
  rows = new Map<number, { getCell: (idx: number) => Record<string, unknown>; height?: number }>();
  columns = new Map<number, { width?: number }>();
  mergeCells(...args: unknown[]) {
    this.merged.push(args);
  }
  getCell() {
    return {} as Record<string, unknown>;
  }
  getRow(index: number) {
    if (!this.rows.has(index)) {
      this.rows.set(index, {
        getCell: () => ({}),
        height: 0
      });
    }
    return this.rows.get(index)!;
  }
  getColumn(index: number) {
    if (!this.columns.has(index)) {
      this.columns.set(index, {});
    }
    return this.columns.get(index)!;
  }
}

class FakeWorkbook {
  creator?: string;
  created?: Date;
  sheet = new FakeWorksheet();
  xlsx = {
    writeBuffer: vi.fn(async () => Buffer.from("excel-buffer"))
  };
  addWorksheet() {
    return this.sheet;
  }
}

class FakePdfPrinter {
  constructor(_fonts: unknown) {}
  createPdfKitDocument() {
    const emitter = new EventEmitter() as EventEmitter & { end: () => void };
    emitter.end = () => {
      emitter.emit("data", Buffer.from("pdf-data"));
      emitter.emit("end");
    };
    return emitter;
  }
}

vi.mock("exceljs", () => ({ default: { Workbook: FakeWorkbook } }));
vi.mock("pdfmake", () => ({ default: FakePdfPrinter }));
vi.mock("../../utils/pdfFonts.js", () => ({
  resolvePdfFontConfig: () => ({ defaultFont: "Noto", fonts: { Noto: { normal: "Noto.ttf" } } })
}));

const { generateReportExcel, generateReportPdf } = await import("./report.export.js");

describe("report.export", () => {
  it("generates excel report for case-status", async () => {
    const buffer = await generateReportExcel("case-status", [{ status: "ACTIVE", count: 2 }], "2026-04-22");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toContain("excel-buffer");
  });

  it("generates pdf report for outstanding-balances", async () => {
    const buffer = await generateReportPdf(
      "outstanding-balances",
      [{ invoiceNumber: "INV-1", clientName: "Client", totalAmount: 100, dueDate: "2026-04-01", daysOverdue: 21 }],
      "2026-04-22"
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toContain("pdf-data");
  });

  it("supports other report specs and throws on unknown report type", async () => {
    await expect(
      generateReportExcel("lawyer-workload", [{ fullName: "A", openCases: 1, openTasks: 2, upcomingHearings: 3 }])
    ).resolves.toBeInstanceOf(Buffer);

    await expect(
      generateReportExcel("hearing-outcomes", [{ outcome: null, count: 2 }])
    ).resolves.toBeInstanceOf(Buffer);

    await expect(generateReportExcel("revenue", [{ month: "2026-04", invoiced: "100", paid: "80" }])).resolves.toBeInstanceOf(Buffer);
    await expect(generateReportExcel("case-profitability", { totalBilled: 100, totalPaid: 70, totalExpenses: 30, grossProfit: 40 })).resolves.toBeInstanceOf(Buffer);

    await expect(generateReportExcel("unknown-type", [])).rejects.toThrow("Unknown report type");
  });
});
