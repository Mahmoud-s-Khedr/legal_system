import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRouteFile(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), "src/routes/app", relativePath), "utf8");
}

describe("full-page form save navigation", () => {
  it("keeps representative create/edit pages configured to exit after save", () => {
    const expectations: Array<{
      file: string;
      navigateSnippet: string;
      requiresBypass?: boolean;
      requiresOnSuccess?: boolean;
    }> = [
      { file: "CaseCreatePage.tsx", navigateSnippet: 'navigate({ to: "/app/cases" })', requiresBypass: true },
      { file: "ClientCreatePage.tsx", navigateSnippet: 'navigate({ to: "/app/clients" })', requiresBypass: true },
      { file: "ClientEditPage.tsx", navigateSnippet: 'navigate({ to: "/app/clients/$clientId"', requiresBypass: true },
      { file: "HearingCreatePage.tsx", navigateSnippet: 'navigate({ to: "/app/hearings" })', requiresBypass: true },
      { file: "HearingEditPage.tsx", navigateSnippet: 'navigate({ to: "/app/hearings" })', requiresBypass: true },
      { file: "TaskCreatePage.tsx", navigateSnippet: 'navigate({ to: "/app/tasks" })', requiresBypass: true },
      {
        file: "InvoiceCreatePage.tsx",
        navigateSnippet: 'navigate({ to: "/app/invoices/$invoiceId"',
        requiresBypass: true,
        requiresOnSuccess: false
      },
      {
        file: "CaseQuickIntakePage.tsx",
        navigateSnippet: 'navigate({ to: "/app/cases/$caseId", params: { caseId } })',
        requiresBypass: true,
        requiresOnSuccess: false
      },
      { file: "TaskDetailPage.tsx", navigateSnippet: 'navigate({ to: "/app/tasks" })' },
      { file: "TemplateCreatePage.tsx", navigateSnippet: 'navigate({ to: "/app/templates" })' },
      { file: "TemplateEditPage.tsx", navigateSnippet: 'navigate({ to: "/app/templates" })' },
      { file: "UserCreatePage.tsx", navigateSnippet: 'navigate({ to: "/app/users" })' },
      { file: "UserDetailPage.tsx", navigateSnippet: 'navigate({ to: "/app/users" })' }
    ];

    for (const { file, navigateSnippet, requiresBypass, requiresOnSuccess = true } of expectations) {
      const source = readRouteFile(file);
      if (requiresOnSuccess) {
        expect(source, `${file} should define an onSuccess handler`).toContain("onSuccess");
      }
      expect(source, `${file} should navigate away after successful save`).toContain(navigateSnippet);
      if (requiresBypass) {
        expect(source, `${file} should use shared unsaved-change bypass helper`).toContain("useUnsavedChangesBypass()");
        expect(source, `${file} should pass bypass ref to useUnsavedChanges`).toContain("bypassBlockRef: bypassRef");
        expect(source, `${file} should allow next navigation before redirect`).toContain("allowNextNavigation();");
      }
    }
  });
});
