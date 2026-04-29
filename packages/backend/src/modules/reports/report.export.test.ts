import { describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";

class FakeWorksheet {
  views: unknown[] = [];
  merged: Array<unknown[]> = [];
  cells = new Map<string, Record<string, unknown>>();
  rows = new Map<number, { getCell: (idx: number) => Record<string, unknown>; height?: number }>();
  columns = new Map<number, { width?: number }>();
  mergeCells(...args: unknown[]) {
    this.merged.push(args);
  }
  getCell(row: number, col?: number) {
    const key = col === undefined ? String(row) : `${row}:${col}`;
    if (!this.cells.has(key)) {
      this.cells.set(key, {});
    }
    return this.cells.get(key)!;
  }
  getRow(index: number) {
    if (!this.rows.has(index)) {
      this.rows.set(index, {
        getCell: (idx: number) => this.getCell(index, idx),
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
  worksheetOptions?: unknown;
  worksheetName?: string;
  static instances: FakeWorkbook[] = [];
  constructor() {
    FakeWorkbook.instances.push(this);
  }
  xlsx = {
    writeBuffer: vi.fn(async () => Buffer.from("excel-buffer"))
  };
  addWorksheet(name: string, options?: unknown) {
    this.worksheetName = name;
    this.worksheetOptions = options;
    return this.sheet;
  }
}

class FakePdfPrinter {
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
  resolvePdfFontConfig: () => ({
    defaultFont: "Helvetica",
    fonts: { Helvetica: { normal: "Helvetica" } },
    usingFallback: true,
    reason: "Cairo fonts missing"
  })
}));

const { generateLitigationSheetExcel, generateReportExcel, generateReportPdf } = await import("./report.export.js");

describe("report.export", () => {
  it("generates excel report for case-status", async () => {
    const buffer = await generateReportExcel("case-status", [{ status: "ACTIVE", count: 2 }], "2026-04-22");
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toContain("excel-buffer");
  });

  it("generates pdf report for outstanding-balances", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const buffer = await generateReportPdf(
      "outstanding-balances",
      [{ invoiceNumber: "INV-1", clientName: "Client", totalAmount: 100, dueDate: "2026-04-01", daysOverdue: 21 }],
      "2026-04-22"
    );
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.toString()).toContain("pdf-data");
    expect(warnSpy).toHaveBeenCalledWith(
      "[report-export] Using fallback PDF font 'Helvetica' (Cairo fonts missing)"
    );
    warnSpy.mockRestore();
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

  it("generates multilingual litigation sheet and applies direction by language", async () => {
    FakeWorkbook.instances.length = 0;
    const rows = [
      {
        clientName: "عميل",
        caseNumber: "100",
        caseSubject: "نزاع",
        previousSessionDate: "2026-01-01",
        upcomingSessionDate: "2026-02-01",
        decision: "DECIDED",
        notes: "ملاحظة"
      }
    ];

    await generateLitigationSheetExcel(rows, "ar", "2026-04-22");
    await generateLitigationSheetExcel(rows, "en", "2026-04-22");
    await generateLitigationSheetExcel(rows, "fr", "2026-04-22");

    const [arBook, enBook, frBook] = FakeWorkbook.instances;
    expect(arBook.worksheetOptions).toEqual({ views: [{ rightToLeft: true }] });
    expect(enBook.worksheetOptions).toEqual({ views: [{ rightToLeft: false }] });
    expect(frBook.worksheetOptions).toEqual({ views: [{ rightToLeft: false }] });

    const arHeader = arBook.sheet.getRow(2).getCell(1);
    const enHeader = enBook.sheet.getRow(2).getCell(1);
    const frHeader = frBook.sheet.getRow(2).getCell(1);
    expect(arHeader.value).toBe("اسم الموكل");
    expect(enHeader.value).toBe("Client Name");
    expect(frHeader.value).toBe("Nom du client");

    const arDecision = arBook.sheet.getRow(3).getCell(6);
    const enDecision = enBook.sheet.getRow(3).getCell(6);
    const frDecision = frBook.sheet.getRow(3).getCell(6);
    expect(arDecision.value).toBe("حكم");
    expect(enDecision.value).toBe("Decided");
    expect(frDecision.value).toBe("Décidée");
  });
});
