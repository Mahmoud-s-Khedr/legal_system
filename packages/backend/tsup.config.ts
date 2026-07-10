import { defineConfig } from "tsup";

/**
 * Desktop build: bundle all dependencies into a single server.js,
 * except native/WASM packages that must remain as external node_modules.
 *
 * Cloud/library build: compile TS to JS without bundling dependencies.
 */

const DESKTOP_EXTERNALS = [
  // ── Ship in dist/node_modules (native binary / WASM) ──────────────
  "@prisma/client",
  ".prisma/client",
  "tesseract.js",
  "tesseract.js-core",
  "pdfmake",
  "@foliojs-fork/pdfkit",
  "@foliojs-fork/fontkit",
  "@foliojs-fork/linebreak",
  "unicode-trie",
  "brotli",

  // ── Mark external but do NOT ship (optional, fail gracefully) ─────
  "@napi-rs/canvas",
  "@napi-rs/canvas-linux-x64-gnu",
  "@napi-rs/canvas-linux-x64-musl",
  "msgpackr",
  "msgpackr-extract",
  "@msgpackr-extract/msgpackr-extract-linux-x64",
  "@fastify/swagger",
  "@fastify/swagger-ui",
];

const DESKTOP_NO_EXTERNAL_PATTERN =
  /^(?!(@prisma\/client(?:\/.*)?|\.prisma\/client(?:\/.*)?|tesseract\.js(?:\/.*)?|tesseract\.js-core(?:\/.*)?|pdfmake(?:\/.*)?|@foliojs-fork\/pdfkit(?:\/.*)?|@foliojs-fork\/fontkit(?:\/.*)?|@foliojs-fork\/linebreak(?:\/.*)?|unicode-trie(?:\/.*)?|brotli(?:\/.*)?|@napi-rs\/canvas(?:\/.*)?|@napi-rs\/canvas-linux-x64-gnu(?:\/.*)?|@napi-rs\/canvas-linux-x64-musl(?:\/.*)?|msgpackr(?:\/.*)?|msgpackr-extract(?:\/.*)?|@msgpackr-extract\/msgpackr-extract-linux-x64(?:\/.*)?|@fastify\/swagger(?:\/.*)?|@fastify\/swagger-ui(?:\/.*)?)).+/;

export default defineConfig(() => {
  const isDesktop = process.env.ELMS_BUILD_TARGET === "desktop";
  const outDir = isDesktop ? "dist/desktop" : "dist/cloud";

  return {
    entry: isDesktop
      ? ["src/server.ts"]
      : [
          "src/index.ts",
          "src/server.ts",
          "src/jobs/extractionWorker.ts",
          "src/jobs/libraryExtractionWorker.ts",
          "src/jobs/docxPreviewWorker.ts"
        ],
    format: "esm",
    target: "node22",
    outDir,
    dts: false,
    splitting: !isDesktop,
    bundle: true,
    noExternal: isDesktop ? [DESKTOP_NO_EXTERNAL_PATTERN] : undefined,
    external: isDesktop ? DESKTOP_EXTERNALS : undefined,
    banner: isDesktop
      ? {
          js: [
            'import { createRequire as __elmsCreateRequire } from "node:module";',
            'import { fileURLToPath as __elmsFileURLToPath } from "node:url";',
            'import { dirname as __elmsDirname } from "node:path";',
            'const require = __elmsCreateRequire(import.meta.url);',
            'const __filename = __elmsFileURLToPath(import.meta.url);',
            'const __dirname = __elmsDirname(__filename);',
          ].join("\n"),
        }
      : undefined,
  };
});
