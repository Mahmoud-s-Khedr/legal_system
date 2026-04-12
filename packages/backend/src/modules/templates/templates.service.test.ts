import { describe, expect, it } from "vitest";
import { htmlToPlainText, substitute } from "./templates.service.js";

describe("templates.service helpers", () => {
  it("replaces known placeholders while preserving unknown placeholders", () => {
    const rendered = substitute("<p>{{caseName}} {{unknown}}</p>", { caseName: "Case A" });
    expect(rendered).toContain("Case A");
    expect(rendered).toContain("{{unknown}}");
  });

  it("converts html content to readable plain text", () => {
    const text = htmlToPlainText("<p>Hello</p><p>World<br/>Again</p>");
    expect(text).toBe("Hello\nWorld\nAgain");
  });
});
