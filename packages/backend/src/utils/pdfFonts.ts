import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

function findCairoFontDir() {
  const candidates = [
    // Source tree
    resolve(process.cwd(), "packages/backend/assets/fonts"),
    // If cwd is packages/backend
    resolve(process.cwd(), "assets/fonts"),
    // Compiled dist layouts
    join(__dirname, "../../assets/fonts"),
    join(__dirname, "../../../assets/fonts"),
    join(__dirname, "../../../../assets/fonts")
  ];

  for (const candidate of candidates) {
    const regularPath = join(candidate, "Cairo-Regular.ttf");
    const boldPath = join(candidate, "Cairo-Bold.ttf");
    if (
      existsSync(regularPath) &&
      existsSync(boldPath) &&
      isValidFontFile(regularPath) &&
      isValidFontFile(boldPath)
    ) {
      return { dir: candidate, regularPath, boldPath };
    }
  }

  return null;
}

function isValidFontFile(filePath: string): boolean {
  try {
    const data = readFileSync(filePath);
    if (data.length < 4) {
      return false;
    }

    const signature = data.subarray(0, 4).toString("latin1");
    if (signature === "OTTO" || signature === "ttcf") {
      return true;
    }

    // TrueType outlines: 0x00 0x01 0x00 0x00
    return data[0] === 0x00 && data[1] === 0x01 && data[2] === 0x00 && data[3] === 0x00;
  } catch {
    return false;
  }
}

export interface PdfFontConfig {
  fonts: Record<string, {
    normal: Buffer | string;
    bold: Buffer | string;
    italics: Buffer | string;
    bolditalics: Buffer | string;
  }>;
  defaultFont: string;
  usingFallback: boolean;
  reason?: string;
}

/**
 * Resolve PDF fonts with deterministic fallback.
 *
 * Preferred: Cairo TTF files for full Arabic rendering.
 * Fallback: built-in Helvetica so exports do not fail with 500 when fonts are missing.
 */
export function resolvePdfFontConfig(): PdfFontConfig {
  const cairo = findCairoFontDir();
  if (cairo) {
    return {
      fonts: {
        Cairo: {
          normal: readFileSync(cairo.regularPath),
          bold: readFileSync(cairo.boldPath),
          italics: readFileSync(cairo.regularPath),
          bolditalics: readFileSync(cairo.boldPath)
        }
      },
      defaultFont: "Cairo",
      usingFallback: false
    };
  }

  return {
    fonts: {
      Helvetica: {
        normal: "Helvetica",
        bold: "Helvetica-Bold",
        italics: "Helvetica-Oblique",
        bolditalics: "Helvetica-BoldOblique"
      }
    },
    defaultFont: "Helvetica",
    usingFallback: true,
    reason: "Cairo TTF fonts not found; using Helvetica fallback"
  };
}
