import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
});

describe("resolvePdfFontConfig", () => {
  it("uses Cairo when font files are valid binaries", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn((filePath: string) =>
        filePath.endsWith("Cairo-Regular.ttf") || filePath.endsWith("Cairo-Bold.ttf")
      ),
      readFileSync: vi.fn((filePath: string) => {
        if (filePath.endsWith("Cairo-Regular.ttf") || filePath.endsWith("Cairo-Bold.ttf")) {
          return Buffer.from([0x00, 0x01, 0x00, 0x00, 0x11, 0x22, 0x33, 0x44]);
        }
        return Buffer.from([]);
      })
    }));

    const { resolvePdfFontConfig } = await import("./pdfFonts.js");
    const config = resolvePdfFontConfig();

    expect(config.defaultFont).toBe("Cairo");
    expect(config.usingFallback).toBe(false);
    expect(Buffer.isBuffer(config.fonts.Cairo.normal)).toBe(true);
  });

  it("falls back to Helvetica when Cairo files are invalid", async () => {
    vi.doMock("node:fs", () => ({
      existsSync: vi.fn((filePath: string) =>
        filePath.endsWith("Cairo-Regular.ttf") || filePath.endsWith("Cairo-Bold.ttf")
      ),
      readFileSync: vi.fn((filePath: string) => {
        if (filePath.endsWith("Cairo-Regular.ttf") || filePath.endsWith("Cairo-Bold.ttf")) {
          return Buffer.from("<!DOCTYPE html><html>");
        }
        return Buffer.from([]);
      })
    }));

    const { resolvePdfFontConfig } = await import("./pdfFonts.js");
    const config = resolvePdfFontConfig();

    expect(config.defaultFont).toBe("Helvetica");
    expect(config.usingFallback).toBe(true);
  });
});
