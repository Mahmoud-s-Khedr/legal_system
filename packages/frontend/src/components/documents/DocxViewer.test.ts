import { describe, expect, it } from "vitest";
import { sanitizeDocxHtml } from "./DocxViewer";

describe("sanitizeDocxHtml", () => {
  it("removes script tags and inline event handlers", () => {
    const html = sanitizeDocxHtml(
      '<p onclick="alert(1)">Hello</p><script>alert(1)</script><img src="https://example.com/a.png" onerror="alert(1)" />'
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("onclick=");
    expect(html).not.toContain("onerror=");
    expect(html).toContain("<p>Hello</p>");
  });

  it("strips javascript URLs and preserves safe links", () => {
    const html = sanitizeDocxHtml(
      '<a href="javascript:alert(1)">bad</a><a href="https://example.com/doc">good</a>'
    );

    expect(html).not.toContain("javascript:");
    expect(html).toContain('href="https://example.com/doc"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("unwraps disallowed tags while keeping child text", () => {
    const html = sanitizeDocxHtml("<div><custom-tag>text</custom-tag></div>");

    expect(html).toContain("text");
    expect(html).not.toContain("custom-tag");
    expect(html).not.toContain("<div");
  });
});
