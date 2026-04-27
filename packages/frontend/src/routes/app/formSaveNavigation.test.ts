import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRouteFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), "src/routes/app", relativePath), "utf8");
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hasNavigateTo(source: string, to: string): boolean {
  const pattern = new RegExp(
    `navigate\\s*\\(\\s*\\{[\\s\\S]*?to\\s*:\\s*["'\`]${escapeRegex(to)}["'\`]`,
    "m"
  );
  return pattern.test(source);
}

function hasNavigateParam(source: string, paramName: string): boolean {
  const pattern = new RegExp(
    `navigate\\s*\\(\\s*\\{[\\s\\S]*?params\\s*:\\s*\\{[\\s\\S]*?\\b${escapeRegex(paramName)}\\b`,
    "m"
  );
  return pattern.test(source);
}

function hasBypassWiring(source: string): boolean {
  const hasBypassHelper = /useUnsavedChangesBypass\s*\(\s*\)/m.test(source);
  const hasBypassRef = /bypassBlockRef\s*:\s*bypassRef/m.test(source);
  const hasAllowNavigation = /allowNextNavigation\s*\(\s*\)\s*;?/m.test(source);
  return hasBypassHelper && hasBypassRef && hasAllowNavigation;
}

describe("full-page form save navigation", () => {
  it("keeps representative create/edit pages configured to exit after save", () => {
    const expectations: Array<{
      file: string;
      navigateTo: string;
      navigateParam?: string;
      requiresBypass?: boolean;
    }> = [
      {
        file: "CaseCreatePage.tsx",
        navigateTo: "/app/cases/$caseId",
        navigateParam: "caseId",
        requiresBypass: true
      },
      { file: "ClientCreatePage.tsx", navigateTo: "/app/clients", requiresBypass: true },
      { file: "ClientEditPage.tsx", navigateTo: "/app/clients/$clientId", requiresBypass: true },
      { file: "HearingCreatePage.tsx", navigateTo: "/app/hearings", requiresBypass: true },
      { file: "HearingEditPage.tsx", navigateTo: "/app/hearings", requiresBypass: true },
      { file: "TaskCreatePage.tsx", navigateTo: "/app/tasks", requiresBypass: true },
      {
        file: "InvoiceCreatePage.tsx",
        navigateTo: "/app/invoices/$invoiceId",
        navigateParam: "invoiceId",
        requiresBypass: true
      },
      {
        file: "CaseQuickIntakePage.tsx",
        navigateTo: "/app/cases/$caseId",
        navigateParam: "caseId",
        requiresBypass: true
      },
      { file: "TaskDetailPage.tsx", navigateTo: "/app/tasks" },
      { file: "TemplateCreatePage.tsx", navigateTo: "/app/templates" },
      { file: "TemplateEditPage.tsx", navigateTo: "/app/templates" },
      { file: "UserCreatePage.tsx", navigateTo: "/app/users" },
      { file: "UserDetailPage.tsx", navigateTo: "/app/users" }
    ];

    for (const { file, navigateTo, navigateParam, requiresBypass } of expectations) {
      const source = readRouteFile(file);
      expect(
        hasNavigateTo(source, navigateTo),
        `${file} should navigate to ${navigateTo} after successful save`
      ).toBe(true);
      if (navigateParam) {
        expect(
          hasNavigateParam(source, navigateParam),
          `${file} should pass ${navigateParam} in navigate params`
        ).toBe(true);
      }
      if (requiresBypass) {
        expect(
          hasBypassWiring(source),
          `${file} should wire unsaved-change bypass helper before redirect`
        ).toBe(true);
      }
    }
  });
});
