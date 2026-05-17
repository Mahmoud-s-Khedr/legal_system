import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readTemplateEditPage() {
  return readFileSync(resolve(process.cwd(), "src/routes/app/TemplateEditPage.tsx"), "utf8");
}

describe("TemplateEditPage regression wiring", () => {
  it("uses functional form updates to avoid stale closure resets", () => {
    const source = readTemplateEditPage();

    expect(source).toContain("setForm((current) => ({ ...current, name: v }))");
    expect(source).toContain("setForm((current) => ({ ...current, language: v }))");
    expect(source).toContain("setForm((current) => ({ ...current, body }))");
  });

  it("uses case selection dropdown for preview/export flow", () => {
    const source = readTemplateEditPage();

    expect(source).toContain("label={t(\"labels.case\")}");
    expect(source).toContain("toCaseSelectOption(t, caseItem)");
    expect(source).toContain("queryFn: () => apiFetch<CaseListResponseDto>(\"/api/cases?limit=200\")");
  });
});

