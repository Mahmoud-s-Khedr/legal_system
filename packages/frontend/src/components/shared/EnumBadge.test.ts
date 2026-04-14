import { describe, expect, it } from "vitest";
import {
  CaseStatus,
  ExtractionStatus,
  InvoiceStatus,
  SessionOutcome,
  TaskPriority,
  TaskStatus
} from "@elms/shared";
import { ENUM_COLORS } from "./EnumBadge";

function expectAllMapped(values: string[]) {
  for (const value of values) {
    expect(ENUM_COLORS[value]).toBeTruthy();
  }
}

describe("ENUM_COLORS coverage", () => {
  it("covers core status enums used by EnumBadge surfaces", () => {
    expectAllMapped(Object.values(CaseStatus));
    expectAllMapped(Object.values(InvoiceStatus));
    expectAllMapped(Object.values(TaskStatus));
    expectAllMapped(Object.values(TaskPriority));
    expectAllMapped(Object.values(SessionOutcome));
    expectAllMapped(Object.values(ExtractionStatus));
  });
});
