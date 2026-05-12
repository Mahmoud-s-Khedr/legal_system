import { describe, expect, it } from "vitest";
import { CalendarDays, Scale } from "lucide-react";
import { buildSidebarNavSections, navConfig } from "./navConfig";

describe("buildSidebarNavSections", () => {
  it("hides protected navigation with no permissions", () => {
    const sections = buildSidebarNavSections({
      t: (key) => key,
      permissions: []
    });

    expect(sections).toEqual([]);
  });

  it("filters and orders permission-gated sections", () => {
    const sections = buildSidebarNavSections({
      t: (key) => key,
      permissions: [
        "dashboard:read",
        "clients:read",
        "cases:read",
        "hearings:read",
        "documents:read",
        "tasks:read",
        "invoices:read",
        "expenses:read",
        "reports:read",
        "users:read",
        "integrations:google_calendar:manage"
      ]
    });

    expect(sections.map((section) => section.id)).toEqual(["core", "finance", "tools", "administration"]);
    expect(sections.find((section) => section.id === "core")?.items.map((item) => item.id)).toEqual([
      "dashboard",
      "clients",
      "cases",
      "calendar",
      "hearings",
      "tasks",
      "documents"
    ]);
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

  it("uses distinct icons for calendar and hearings", () => {
    const calendarItem = navConfig.find((item) => item.id === "calendar");
    const hearingsItem = navConfig.find((item) => item.id === "hearings");

    expect(calendarItem?.icon).toBe(CalendarDays);
    expect(hearingsItem?.icon).toBe(Scale);
    expect(calendarItem?.icon).not.toBe(hearingsItem?.icon);
  });
});
