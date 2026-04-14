import { afterEach, describe, expect, it, vi } from "vitest";

function languageCode(value: string | undefined) {
  return value?.split("-")[0];
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  window.localStorage.clear();
});

describe("i18n language initialization", () => {
  it("applies authenticated preferred language", async () => {
    vi.resetModules();
    const { default: i18n, applyUserPreferredLanguage } = await import("./index");

    await i18n.changeLanguage("ar");
    await applyUserPreferredLanguage("fr");

    expect(languageCode(i18n.resolvedLanguage)).toBe("fr");
  });

  it("does not duplicate languageChanged storage writes after module re-import", async () => {
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem");

    vi.resetModules();
    const firstImport = await import("./index");
    await firstImport.default.changeLanguage("en");

    vi.resetModules();
    const secondImport = await import("./index");
    await secondImport.default.changeLanguage("fr");

    const frenchWrites = setItemSpy.mock.calls.filter(
      ([key, value]) => key === "elms-lang" && value === "fr"
    );
    expect(frenchWrites).toHaveLength(1);
  });
});
