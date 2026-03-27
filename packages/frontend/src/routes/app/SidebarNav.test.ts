import { describe, expect, it } from "vitest";
import { getSidebarHeadingClassName, getSidebarItemClassName, isArabicLanguage } from "./SidebarNav";

describe("SidebarNav style helpers", () => {
  it("detects Arabic language variants", () => {
    expect(isArabicLanguage("ar")).toBe(true);
    expect(isArabicLanguage("ar-EG")).toBe(true);
    expect(isArabicLanguage("en")).toBe(false);
  });

  it("uses locale-aware heading typography", () => {
    const arabicHeading = getSidebarHeadingClassName("ar");
    const englishHeading = getSidebarHeadingClassName("en");

    expect(arabicHeading).toContain("tracking-normal");
    expect(arabicHeading).not.toContain("uppercase");
    expect(englishHeading).toContain("uppercase");
  });

  it("returns distinct classes for active and inactive nav items", () => {
    const activeClass = getSidebarItemClassName(true);
    const inactiveClass = getSidebarItemClassName(false);

    expect(activeClass).toContain("bg-[var(--sidebar-item-active)]");
    expect(inactiveClass).toContain("hover:bg-[var(--sidebar-item-hover)]");
    expect(activeClass).not.toBe(inactiveClass);
  });
});
