import type { TFunction } from "i18next";
import { ApiError } from "./api";
import { extractApiValidationError } from "./validationErrors";

const VALIDATION_ISSUE_KEY_MAP: Record<string, string> = {
  VALIDATION_REQUIRED: "errors.validation.issue.required",
  VALIDATION_INVALID_TYPE: "errors.validation.issue.invalidType",
  VALIDATION_INVALID_UUID: "errors.validation.issue.invalidUuid",
  VALIDATION_INVALID_EMAIL: "errors.validation.issue.invalidEmail",
  VALIDATION_INVALID_DATE: "errors.validation.issue.invalidDate",
  VALIDATION_INVALID_DATETIME: "errors.validation.issue.invalidDatetime",
  VALIDATION_INVALID_STRING_FORMAT: "errors.validation.issue.invalidFormat",
  VALIDATION_INVALID_ENUM: "errors.validation.issue.invalidOption",
  VALIDATION_TOO_SMALL: "errors.validation.issue.tooSmall",
  VALIDATION_TOO_BIG: "errors.validation.issue.tooBig",
  VALIDATION_INVALID_VALUE: "errors.validation.issue.invalidValue"
};

const BACKEND_ERROR_KEY_MAP: Record<string, string> = {
  VALIDATION_ERROR: "errors.backend.validationFailed",
  SEAT_LIMIT_REACHED: "users.seatLimitReached",
  USER_SEAT_LIMIT_REACHED: "users.seatLimitReached",
  USER_EMAIL_EXISTS: "errors.backend.duplicateEmail",
  DUPLICATE_EMAIL: "errors.backend.duplicateEmail",
  EMAIL_ALREADY_EXISTS: "errors.backend.duplicateEmail",
  ROLE_KEY_EXISTS: "errors.backend.duplicateRoleKey",
  DUPLICATE_ROLE_KEY: "errors.backend.duplicateRoleKey",
  ROLE_ALREADY_EXISTS: "errors.backend.duplicateRoleKey",
  INVALID_ROLE: "errors.backend.invalidRole",
  ROLE_NOT_FOUND: "errors.backend.invalidRole",
  ROLE_SYSTEM_READ_ONLY: "errors.backend.systemRoleProtected",
  SYSTEM_ROLE_EDIT_FORBIDDEN: "errors.backend.systemRoleProtected",
  PROTECTED_SYSTEM_ROLE: "errors.backend.systemRoleProtected",
  ROLE_IN_USE: "errors.backend.roleInUse",
  ROLE_HAS_ASSIGNED_USERS: "errors.backend.roleInUse"
};

type ApiValidationIssuePayload = {
  path?: unknown;
  code?: unknown;
  message?: unknown;
  messageKey?: unknown;
  params?: unknown;
};

type ApiValidationPayload = {
  code?: unknown;
  message?: unknown;
  messageKey?: unknown;
  issues?: unknown;
};

function toPathString(path: unknown): string {
  if (typeof path === "string") {
    return path;
  }

  if (Array.isArray(path)) {
    return path
      .map((segment) =>
        typeof segment === "number" ? `[${segment}]` : String(segment)
      )
      .join(".")
      .replace(/\.\[/g, "[");
  }

  return "";
}

function toDotPath(path: string): string {
  return path.replace(/\[(\d+)\]/g, ".$1");
}

function translateIfExists(
  t: TFunction<"app">,
  key: string,
  params?: Record<string, unknown>
): string | null {
  const translated = t(key, params);
  return translated === key ? null : translated;
}

function normalizeKey(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function translateByMessageKey(
  t: TFunction<"app">,
  messageKey: string | null,
  params?: Record<string, unknown>
): string | null {
  if (!messageKey) {
    return null;
  }

  const validationKey = VALIDATION_ISSUE_KEY_MAP[messageKey];
  if (validationKey) {
    return translateIfExists(t, validationKey, params);
  }

  const backendKey = BACKEND_ERROR_KEY_MAP[messageKey];
  if (backendKey) {
    return translateIfExists(t, backendKey, params);
  }

  return null;
}

function resolveTopLevelMessage(
  t: TFunction<"app">,
  error: unknown,
  fallbackMessage: string
): string {
  if (error instanceof ApiError && typeof error.details === "object" && error.details !== null) {
    const payload = error.details as ApiValidationPayload;
    const translatedByMessageKey = translateByMessageKey(
      t,
      normalizeKey(payload.messageKey)
    );
    if (translatedByMessageKey) {
      return translatedByMessageKey;
    }

    const translatedByCode = translateByMessageKey(t, normalizeKey(payload.code));
    if (translatedByCode) {
      return translatedByCode;
    }

    if (typeof payload.message === "string" && payload.message.trim().length > 0) {
      return payload.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return fallbackMessage;
}

export function localizeUserRoleApiErrorMessage(
  t: TFunction<"app">,
  error: unknown,
  fallbackMessage: string
): string {
  return resolveTopLevelMessage(t, error, fallbackMessage);
}

export function localizeUserRoleFormError(
  t: TFunction<"app">,
  error: unknown,
  fallbackMessage: string
): {
  message: string;
  fieldErrors: Record<string, string>;
  isValidationError: boolean;
} {
  const validation = extractApiValidationError(error);
  if (!validation) {
    return {
      message: resolveTopLevelMessage(t, error, fallbackMessage),
      fieldErrors: {},
      isValidationError: false
    };
  }

  const nextFieldErrors = { ...validation.fieldErrors };

  if (error instanceof ApiError && typeof error.details === "object" && error.details !== null) {
    const payload = error.details as ApiValidationPayload;
    if (Array.isArray(payload.issues)) {
      for (const item of payload.issues) {
        if (typeof item !== "object" || item === null) {
          continue;
        }
        const issue = item as ApiValidationIssuePayload;
        const path = toDotPath(toPathString(issue.path).trim());
        if (!path || !(path in nextFieldErrors)) {
          continue;
        }
        const translated = translateByMessageKey(
          t,
          normalizeKey(issue.messageKey),
          typeof issue.params === "object" && issue.params !== null
            ? (issue.params as Record<string, unknown>)
            : undefined
        );
        if (translated) {
          nextFieldErrors[path] = translated;
        }
      }
    }
  }

  const message =
    resolveTopLevelMessage(t, error, fallbackMessage) ||
    t("errors.backend.validationFailed");

  return {
    message,
    fieldErrors: nextFieldErrors,
    isValidationError: true
  };
}
