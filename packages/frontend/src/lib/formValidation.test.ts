import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { resolveFormValidationError } from "./formValidation";

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
});
