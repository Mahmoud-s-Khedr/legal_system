import { describe, expect, it } from "vitest";
import { isValidDateTimeInput, toIsoOrEmpty } from "./dateInput";

describe("date input helpers", () => {
  it("validates datetime-local style values", () => {
    expect(isValidDateTimeInput("2026-03-18T08:09")).toBe(true);
    expect(isValidDateTimeInput("")).toBe(false);
    expect(isValidDateTimeInput("invalid")).toBe(false);
  });

  it("converts valid values to ISO and ignores invalid values", () => {
    expect(toIsoOrEmpty("2026-03-18T08:09")).toContain("2026-03-18T");
    expect(toIsoOrEmpty("invalid")).toBe("");
    expect(toIsoOrEmpty("")).toBe("");
  });
});
