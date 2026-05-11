import { describe, expect, it } from "vitest";
import { ApiError } from "./api";
import { extractApiValidationError, pickFieldError } from "./validationErrors";

describe("validationErrors", () => {
  it("extracts field errors and preserves issue params", () => {
    const error = new ApiError("Validation failed", 400, {
      code: "VALIDATION_ERROR",
      message: "Please review the highlighted fields and try again.",
      issues: [
        {
          path: "contacts[0].email",
          code: "invalid_format",
          message: "Enter a valid email address.",
          messageKey: "VALIDATION_INVALID_EMAIL",
          params: { format: "email" }
        }
      ]
    });

    const result = extractApiValidationError(error);
    expect(result).not.toBeNull();
    expect(result?.fieldErrors["contacts.0.email"]).toBe("Enter a valid email address.");
    expect(result?.issues[0]?.params).toEqual({ format: "email" });
  });

  it("keeps first issue per field and supports candidate lookup", () => {
    const error = new ApiError("Validation failed", 400, {
      code: "VALIDATION_ERROR",
      message: "Please review the highlighted fields and try again.",
      issues: [
        { path: "name", message: "This field is required." },
        { path: "name", message: "Must be at least 2 characters." }
      ]
    });

    const result = extractApiValidationError(error);
    expect(result?.fieldErrors.name).toBe("This field is required.");
    expect(pickFieldError(result?.fieldErrors ?? {}, ["missing", "name"])).toBe(
      "This field is required."
    );
  });
});
