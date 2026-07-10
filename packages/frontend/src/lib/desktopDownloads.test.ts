import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

async function importDesktopDownloads() {
  vi.resetModules();
  return import("./desktopDownloads");
}

describe("desktopDownloads", () => {
  let createObjectUrl: ReturnType<typeof vi.fn>;
  let revokeObjectUrl: ReturnType<typeof vi.fn>;
  let clickSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
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
  });

  it("triggers a browser download flow", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const { saveBlobToDownloads } = await importDesktopDownloads();
    const blob = new Blob(["hello"], { type: "text/plain" });

    const result = await saveBlobToDownloads(blob, "browser-file.txt");

    expect(result).toBeNull();
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(revokeObjectUrl).toHaveBeenCalledWith("blob:test-download-url");

    const anchor = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("browser-file.txt");
  });

  it("normalizes empty filenames to download.bin", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const { saveBlobToDownloads } = await importDesktopDownloads();
    const blob = new Blob(["x"], { type: "text/plain" });

    await saveBlobToDownloads(blob, "   ");

    const anchor = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("download.bin");
  });

  it("saveTextToDownloads wraps text in a blob and downloads it", async () => {
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const { saveTextToDownloads } = await importDesktopDownloads();

    const result = await saveTextToDownloads("hello world", "notes.txt");

    expect(result).toBeNull();
    expect(createObjectUrl).toHaveBeenCalledTimes(1);
    const anchor = appendSpy.mock.calls[0]?.[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("notes.txt");
  });
});
