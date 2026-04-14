import { describe, expect, it } from "vitest";
import {
  fromDatePickerValue,
  toDatePickerValue
} from "./dateInput";

describe("dateInput date picker helpers", () => {
  it("converts date strings to/from picker value", () => {
    const parsed = toDatePickerValue("2026-03-28", "date");
    expect(parsed?.format("YYYY-MM-DD")).toBe("2026-03-28");
    expect(fromDatePickerValue(parsed ?? null, "date")).toBe("2026-03-28");
  });

  it("converts datetime-local strings to/from picker value", () => {
    const parsed = toDatePickerValue("2026-03-28T09:00", "datetime-local");
    expect(parsed?.format("YYYY-MM-DDTHH:mm")).toBe("2026-03-28T09:00");
    expect(fromDatePickerValue(parsed ?? null, "datetime-local")).toBe("2026-03-28T09:00");
  });

  it("returns null/empty for invalid or empty inputs", () => {
    expect(toDatePickerValue("", "date")).toBeNull();
    expect(toDatePickerValue(null, "datetime-local")).toBeNull();
    expect(toDatePickerValue("not-a-date", "date")).toBeNull();
    expect(fromDatePickerValue(null, "date")).toBe("");
  });

  it("recovers date-only values from ISO timestamps using UTC date", () => {
    const parsed = toDatePickerValue("2026-03-28T00:00:00.000Z", "date");
    expect(parsed?.format("YYYY-MM-DD")).toBe("2026-03-28");
  });
});
