import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import {
  resolveFormValidationError,
  validateLaterDateTimeField,
  validateRequiredDateTimeField
} from "./formValidation";

describe("resolveFormValidationError", () => {
  it("returns field errors for validation payloads", () => {
    const error = new ApiError("Validation failed", 400, {
      code: "VALIDATION_ERROR",
      message: "Please review the highlighted fields and try again.",
      issues: [
        { path: ["labelEn"], message: "This field is required." },
        { path: ["contacts", 0, "email"], message: "Enter a valid email." }
      ]
    });

    const result = resolveFormValidationError(error, "fallback");
    expect(result.isValidationError).toBe(true);
    expect(result.message).toContain("Please review");
    expect(result.fieldErrors.labelEn).toBe("This field is required.");
    expect(result.fieldErrors["contacts.0.email"]).toBe("Enter a valid email.");
  });

  it("falls back to regular error message for non-validation errors", () => {
    const result = resolveFormValidationError(new Error("Request failed"), "fallback");
    expect(result.isValidationError).toBe(false);
    expect(result.message).toBe("Request failed");
    expect(result.fieldErrors).toEqual({});
  });

  it("validates required datetime field when empty", () => {
    const result = validateRequiredDateTimeField(
      "",
      "sessionDatetime",
      "Session date is required."
    );
    expect(result.isValid).toBe(false);
    expect(result.message).toBe("Session date is required.");
    expect(result.fieldErrors).toEqual({
      sessionDatetime: "Session date is required."
    });
  });

  it("validates required datetime field when format is invalid", () => {
    const result = validateRequiredDateTimeField(
      "invalid-date-value",
      "sessionDatetime",
      "Session date is required."
    );
    expect(result.isValid).toBe(false);
    expect(result.message).toBe("Session date is required.");
    expect(result.fieldErrors).toEqual({
      sessionDatetime: "Session date is required."
    });
  });

  it("passes required datetime validation when valid", () => {
    const result = validateRequiredDateTimeField(
      "2026-05-01T09:10",
      "sessionDatetime",
      "Session date is required."
    );
    expect(result.isValid).toBe(true);
    expect(result.message).toBeNull();
    expect(result.fieldErrors).toEqual({});
  });

  it("passes next-session ordering when next session is empty", () => {
    const result = validateLaterDateTimeField(
      "2026-05-01T09:10",
      "",
      "nextSessionAt",
      "Next session must be later."
    );
    expect(result.isValid).toBe(true);
  });

  it("fails next-session ordering when not later than current session", () => {
    const result = validateLaterDateTimeField(
      "2026-05-01T09:10",
      "2026-05-01T09:10",
      "nextSessionAt",
      "Next session must be later."
    );
    expect(result.isValid).toBe(false);
    expect(result.fieldErrors).toEqual({
      nextSessionAt: "Next session must be later."
    });
  });

  it("passes next-session ordering when later than current session", () => {
    const result = validateLaterDateTimeField(
      "2026-05-01T09:10",
      "2026-05-01T10:10",
      "nextSessionAt",
      "Next session must be later."
    );
    expect(result.isValid).toBe(true);
  });
});
