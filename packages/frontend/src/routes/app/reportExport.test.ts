import { afterEach, describe, expect, it, vi } from "vitest";

const apiDownload = vi.fn();
const saveBlobToDownloads = vi.fn();

vi.mock("../../lib/api", () => ({ apiDownload }));
vi.mock("../../lib/desktopDownloads", () => ({ saveBlobToDownloads }));

const { downloadReportFile } = await import("./reportExport");

describe("downloadReportFile", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("uses API-provided filename when present", async () => {
    const blob = new Blob(["x"], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    apiDownload.mockResolvedValue({ blob, filename: "server-name.xlsx", contentType: blob.type });

    await downloadReportFile("/api/reports/case-status/export?format=excel", "fallback.xlsx");

    expect(apiDownload).toHaveBeenCalledWith("/api/reports/case-status/export?format=excel");
    expect(saveBlobToDownloads).toHaveBeenCalledWith(blob, "server-name.xlsx");
  });

  it("falls back to provided filename", async () => {
    const blob = new Blob(["x"], { type: "application/pdf" });
    apiDownload.mockResolvedValue({ blob, filename: undefined, contentType: blob.type });

    await downloadReportFile("/api/reports/case-status/export?format=pdf", "fallback.pdf");

    expect(saveBlobToDownloads).toHaveBeenCalledWith(blob, "fallback.pdf");
  });
});
