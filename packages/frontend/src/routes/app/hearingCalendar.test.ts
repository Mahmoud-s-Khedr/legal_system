import { describe, expect, it } from "vitest";
import {
  getVisibleRange,
  resolveWeekStartIndex,
  shiftFocusDate,
  slotDateTime,
  toDateTimeLocalValue
} from "./hearingCalendar";

describe("hearingCalendar", () => {
  it("expands month view to whole weeks", () => {
    const range = getVisibleRange("month", new Date("2026-03-18T10:00:00.000Z"), 0);

    expect(range.from.getFullYear()).toBe(2026);
    expect(range.from.getMonth()).toBe(2);
    expect(range.from.getDate()).toBe(1);
    expect(range.to.getFullYear()).toBe(2026);
    expect(range.to.getMonth()).toBe(3);
    expect(range.to.getDate()).toBe(4);
  });

  it("moves focus dates by view granularity", () => {
    const dayShift = shiftFocusDate("day", new Date("2026-03-18T00:00:00.000Z"), 1);
    const weekShift = shiftFocusDate("week", new Date("2026-03-18T00:00:00.000Z"), -1);
    const monthShift = shiftFocusDate("month", new Date("2026-03-18T00:00:00.000Z"), 1);

    expect(dayShift.getDate()).toBe(19);
    expect(weekShift.getDate()).toBe(11);
    expect(monthShift.getMonth()).toBe(3);
    expect(monthShift.getDate()).toBe(1);
  });

  it("resolves locale week starts", () => {
    expect(resolveWeekStartIndex("ar")).toBe(6);
    expect(resolveWeekStartIndex("fr-FR")).toBe(1);
    expect(resolveWeekStartIndex("en-US")).toBe(0);
  });

  it("formats ISO strings for datetime-local inputs", () => {
    expect(toDateTimeLocalValue("2026-03-18T14:45:00.000Z")).toMatch(/^2026-03-18T/);
    expect(slotDateTime(new Date("2026-03-18T00:00:00.000Z"), 9)).toMatch(
      /^2026-03-18T09:00$/
    );
  });
});
