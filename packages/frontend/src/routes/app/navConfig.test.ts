import { AuthMode } from "@elms/shared";
import { describe, expect, it } from "vitest";
import { buildSidebarNavSections } from "./navConfig";

describe("buildSidebarNavSections", () => {
  it("keeps core navigation available with no permissions", () => {
    const sections = buildSidebarNavSections({
      t: (key) => key,
      mode: AuthMode.LOCAL,
      permissions: []
    });

    expect(sections.map((section) => section.id)).toEqual(["core", "tools"]);
    expect(sections[0]?.items.map((item) => item.id)).toEqual([
      "dashboard",
      "clients",
      "cases",
      "calendar",
      "hearings",
      "tasks",
      "documents"
    ]);
    expect(sections[1]?.id).toBe("tools");
    expect(sections[1]?.items.map((item) => item.id)).toEqual(["ppoPortal"]);
  });

  it("filters and orders permission-gated sections", () => {
    const sections = buildSidebarNavSections({
      t: (key) => key,
      mode: AuthMode.CLOUD,
      permissions: ["invoices:read", "reports:read", "users:read"]
    });

    expect(sections.map((section) => section.id)).toEqual(["core", "finance", "tools", "administration"]);
    expect(sections.find((section) => section.id === "finance")?.items.map((item) => item.id)).toEqual([
      "invoices",
      "expenses"
    ]);
    expect(sections.find((section) => section.id === "tools")?.items.map((item) => item.id)).toEqual([
      "reports",
      "ppoPortal"
    ]);
    expect(sections.find((section) => section.id === "administration")?.items.map((item) => item.id)).toEqual(["users"]);
  });
});
