import { afterEach, describe, expect, it, vi } from "vitest";

const apiDownload = vi.fn();

vi.mock("../../lib/api", () => ({ apiDownload }));

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

    const createObjectURL = vi.fn(() => "blob:report");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL
    });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    const appendChild = vi.spyOn(document.body, "appendChild");
    const removeChild = vi.spyOn(document.body, "removeChild");

    await downloadReportFile("/api/reports/case-status/export?format=excel", "fallback.xlsx");

    const appendedAnchor = appendChild.mock.calls[0]?.[0] as HTMLAnchorElement | undefined;
    expect(apiDownload).toHaveBeenCalledWith("/api/reports/case-status/export?format=excel");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(appendedAnchor?.download).toBe("server-name.xlsx");
    expect(click).toHaveBeenCalledOnce();
    expect(appendChild).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });

  it("falls back to provided filename", async () => {
    const blob = new Blob(["x"], { type: "application/pdf" });
    apiDownload.mockResolvedValue({ blob, filename: undefined, contentType: blob.type });

    const createObjectURL = vi.fn(() => "blob:report");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      writable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      writable: true,
      value: revokeObjectURL
    });
    const appendChild = vi.spyOn(document.body, "appendChild");
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await downloadReportFile("/api/reports/case-status/export?format=pdf", "fallback.pdf");

    const appendedAnchor = appendChild.mock.calls[0]?.[0] as HTMLAnchorElement | undefined;
    expect(appendedAnchor?.download).toBe("fallback.pdf");
    expect(appendedAnchor?.href).toContain("blob:report");
    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:report");
  });
});
