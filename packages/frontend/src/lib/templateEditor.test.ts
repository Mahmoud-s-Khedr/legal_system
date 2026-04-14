import { describe, expect, it } from "vitest";
import { isTemplateHtmlEmpty, normalizeTemplateHtml } from "./templateEditor";

describe("templateEditor", () => {
  it("normalizes known placeholder tokens into chips", () => {
    const html = normalizeTemplateHtml("<p>Hello {{caseName}} and {{unknownKey}}</p>");

    expect(html).toContain('data-placeholder-key="caseName"');
    expect(html).toContain("{{unknownKey}}");
  });

  it("converts legacy plain text to html paragraphs", () => {
    const html = normalizeTemplateHtml("Line one\nLine two");

    expect(html).toContain("<p>Line one</p>");
    expect(html).toContain("<p>Line two</p>");
  });

  it("treats placeholder-only content as non-empty", () => {
    const html = normalizeTemplateHtml("{{caseName}}");

    expect(isTemplateHtmlEmpty(html)).toBe(false);
  });

  it("detects empty editor content", () => {
    expect(isTemplateHtmlEmpty("<p><br></p>")).toBe(true);
  });

  it("keeps placeholder span keys during normalization", () => {
    const html = normalizeTemplateHtml(
      '<p><span data-placeholder-key="caseName">Custom label</span></p>'
    );

    expect(html).toContain('data-placeholder-key="caseName"');
    expect(html).toContain("{{caseName}}");
  });
});
