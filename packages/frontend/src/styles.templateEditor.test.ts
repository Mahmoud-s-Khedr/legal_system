import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("template editor list styles", () => {
  it("restores bullets and numbering markers for template content", () => {
    const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

    expect(css).toContain(".template-editor-content ul");
    expect(css).toContain(".template-render-content ul");
    expect(css).toContain("list-style-type: disc;");

    expect(css).toContain(".template-editor-content ol");
    expect(css).toContain(".template-render-content ol");
    expect(css).toContain("list-style-type: decimal;");

    expect(css).toContain("padding-inline-start: 1.25rem;");
  });
});
