import { describe, expect, it, vi } from "vitest";

vi.mock("html-to-image", () => ({
  toPng: vi.fn().mockResolvedValue("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO7Zs0kAAAAASUVORK5CYII=")
}));
vi.mock("jspdf", () => ({
  jsPDF: vi.fn().mockImplementation(() => ({
    internal: { pageSize: { getWidth: () => 800, getHeight: () => 600 } },
    addImage: vi.fn(),
    output: vi.fn(() => new Blob(["pdf"], { type: "application/pdf" }))
  }))
}));
vi.mock("../../lib/desktopDownloads", () => ({
  saveBlobToDownloads: vi.fn().mockResolvedValue("/tmp/report.png")
}));

import { exportReportGraphAsPdf, exportReportGraphAsPng } from "./reportGraphExport";
import { saveBlobToDownloads } from "../../lib/desktopDownloads";

describe("report graph export", () => {
  it("exports png with expected filename", async () => {
    const el = document.createElement("div");
    await exportReportGraphAsPng(el, "report-a-graph");
    expect(saveBlobToDownloads).toHaveBeenCalledWith(expect.any(Blob), "report-a-graph.png");
  });

  it("exports pdf with expected filename", async () => {
    const el = document.createElement("div");
    await exportReportGraphAsPdf(el, "report-a-graph");
    expect(saveBlobToDownloads).toHaveBeenCalledWith(expect.any(Blob), "report-a-graph.pdf");
  });
});
