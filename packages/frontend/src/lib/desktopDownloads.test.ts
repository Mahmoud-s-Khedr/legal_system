import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/api/core", () => ({
  invoke: invokeMock
}));

async function importDesktopDownloads(desktopShell: boolean) {
  vi.resetModules();
  vi.stubEnv("VITE_DESKTOP_SHELL", desktopShell ? "true" : "false");
  return import("./desktopDownloads");
}

describe("desktopDownloads", () => {
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    invokeMock.mockReset();
    clickSpy = vi.fn();
    createObjectUrl = vi.fn(() => "blob:test-download-url");
    revokeObjectUrl = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: createObjectUrl,
      revokeObjectURL: revokeObjectUrl
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(clickSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("uses desktop invoke command path when desktop shell is enabled", async () => {
    const { saveBlobToDownloads } = await importDesktopDownloads(true);
    const blob = new Blob(["ab"], { type: "text/plain" });
    invokeMock.mockResolvedValue({ ok: true, path: "/tmp/report.txt" });

    const savedPath = await saveBlobToDownloads(blob, "report.txt");

    expect(savedPath).toBe("/tmp/report.txt");
    expect(invokeMock).toHaveBeenCalledWith("desktop_save_download_file", {
      filename: "report.txt",
      bytes: [97, 98]
    });
  });

  it("falls back to browser download flow when desktop shell is disabled", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const { saveBlobToDownloads } = await importDesktopDownloads(false);
    const blob = new Blob(["hello"], { type: "text/plain" });

    const result = await saveBlobToDownloads(blob, "browser-file.txt");

    expect(result).toBeNull();
    expect(invokeMock).not.toHaveBeenCalled();
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test-download-url");

    const anchor = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("browser-file.txt");
  });

  it("normalizes empty filenames to download.bin", async () => {
    const { saveBlobToDownloads } = await importDesktopDownloads(true);
    const blob = new Blob(["x"], { type: "text/plain" });
    invokeMock.mockResolvedValue({ ok: true, path: "/tmp/download.bin" });

    await saveBlobToDownloads(blob, "   ");

    expect(invokeMock).toHaveBeenCalledWith("desktop_save_download_file", {
      filename: "download.bin",
      bytes: [120]
    });
  });

  it("throws a readable error when desktop save fails", async () => {
    const { saveBlobToDownloads } = await importDesktopDownloads(true);
    const blob = new Blob(["x"], { type: "text/plain" });
    invokeMock.mockResolvedValue({ ok: false, code: "DESKTOP_DOWNLOAD_SAVE_FAILED" });

    await expect(saveBlobToDownloads(blob, "x.txt")).rejects.toThrow(
      "Saving the downloaded file failed."
    );
  });
});
