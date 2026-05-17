import { describe, expect, it } from "vitest";
import i18n from "../i18n";
import { ApiError } from "./api";
import {
  localizeUserRoleApiErrorMessage,
  localizeUserRoleFormError
} from "./userRoleErrorLocalization";

describe("userRoleErrorLocalization", () => {
  it("localizes top-level backend messageKey", async () => {
    await i18n.changeLanguage("en");
    const t = i18n.getFixedT("en", "app");
    const error = new ApiError("Seat limit reached", 409, {
      code: "SEAT_LIMIT_REACHED",
      messageKey: "SEAT_LIMIT_REACHED"
    });

    expect(localizeUserRoleApiErrorMessage(t, error, t("errors.fallback"))).toBe(
      t("users.seatLimitReached")
    );
  });

  it("localizes field issue messageKey values", async () => {
    await i18n.changeLanguage("en");
    const t = i18n.getFixedT("en", "app");
    const error = new ApiError("Validation failed", 400, {
      code: "VALIDATION_ERROR",
      messageKey: "VALIDATION_ERROR",
      issues: [
        {
          path: ["email"],
          message: "Enter a valid email address.",
          messageKey: "VALIDATION_INVALID_EMAIL"
        }
      ]
    });

    const result = localizeUserRoleFormError(t, error, t("errors.fallback"));
    expect(result.isValidationError).toBe(true);
    expect(result.message).toBe(t("errors.backend.validationFailed"));
    expect(result.fieldErrors.email).toBe(t("errors.validation.issue.invalidEmail"));
  });

  it("falls back to raw backend message when messageKey is unknown", async () => {
    await i18n.changeLanguage("en");
    const t = i18n.getFixedT("en", "app");
    const error = new ApiError("Custom backend failure", 400, {
      code: "CUSTOM_FAILURE",
      messageKey: "CUSTOM_FAILURE",
      message: "Custom backend failure"
    });

    expect(localizeUserRoleApiErrorMessage(t, error, t("errors.fallback"))).toBe(
      "Custom backend failure"
    );
  });

  it("falls back to default fallback message for empty payload", async () => {
    await i18n.changeLanguage("en");
    const t = i18n.getFixedT("en", "app");
    const error = new ApiError("", 500, {
      code: "UNKNOWN",
      message: ""
    });

    expect(localizeUserRoleApiErrorMessage(t, error, t("errors.fallback"))).toBe(
      t("errors.fallback")
    );
  });
});
