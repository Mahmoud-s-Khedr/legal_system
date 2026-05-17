import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readRouteSource(fileName: string) {
  return readFileSync(resolve(process.cwd(), `src/routes/app/${fileName}`), "utf8");
}

describe("user/role localization wiring", () => {
  it("uses i18n key for role-create permission validation", () => {
    const source = readRouteSource("RoleCreatePage.tsx");

    expect(source).toContain('setError(t("roles.validation.permissionRequired"));');
    expect(source).not.toContain("Select at least one permission.");
  });

  it("uses localized role key placeholder", () => {
    const source = readRouteSource("RoleCreatePage.tsx");

    expect(source).toContain('placeholder={t("roles.roleKeyPlaceholder")}');
  });

  it("uses message-key localization helper for user create errors", () => {
    const source = readRouteSource("UserCreatePage.tsx");

    expect(source).toContain("localizeUserRoleFormError(t, err, t(\"errors.fallback\"))");
    expect(source).not.toContain("toLowerCase().includes(\"seat limit\")");
  });
});
