import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function expectSafeImageAcceptList(source: string) {
  expect(source).toContain(".pdf");
  expect(source).toContain(".docx");
  expect(source).toContain(".jpg");
  expect(source).toContain(".jpeg");
  expect(source).toContain(".png");
  expect(source).toContain(".tif");
  expect(source).toContain(".tiff");
  expect(source).toContain(".webp");
  expect(source).toContain(".bmp");
  expect(source).toContain(".gif");
}

describe("document upload accept types", () => {
  it("includes safe image/scanner extensions in DocumentUploadForm", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/documents/DocumentUploadForm.tsx"),
      "utf8"
    );
    expectSafeImageAcceptList(source);
  });

  it("includes safe image/scanner extensions in VersionHistory upload", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src/components/documents/VersionHistory.tsx"),
      "utf8"
    );
    expectSafeImageAcceptList(source);
  });
});
