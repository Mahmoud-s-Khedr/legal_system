import { ApiError } from "./api";

export type ApiValidationIssue = {
  path: string;
  code?: string;
  message: string;
  messageKey?: string;
};

export type ApiValidationErrorDetails = {
  message: string;
  fieldErrors: Record<string, string>;
  issues: ApiValidationIssue[];
};

type ApiValidationPayload = {
  code?: unknown;
  message?: unknown;
  issues?: unknown;
};

type ApiValidationIssuePayload = {
  path?: unknown;
  code?: unknown;
  message?: unknown;
  messageKey?: unknown;
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

export function extractApiValidationError(error: unknown): ApiValidationErrorDetails | null {
  if (!(error instanceof ApiError)) {
    return null;
  }

  const details = error.details;
  if (typeof details !== "object" || details === null) {
    return null;
  }

  const payload = details as ApiValidationPayload;
  if (payload.code !== "VALIDATION_ERROR") {
    return null;
  }

  const issues: ApiValidationIssue[] = [];
  if (Array.isArray(payload.issues)) {
    for (const entry of payload.issues) {
      if (typeof entry !== "object" || entry === null) {
        continue;
      }
      const issue = entry as ApiValidationIssuePayload;
      if (typeof issue.message !== "string" || issue.message.trim().length === 0) {
        continue;
      }

      issues.push({
        path: toPathString(issue.path).trim(),
        code: typeof issue.code === "string" ? issue.code : undefined,
        message: issue.message,
        messageKey: typeof issue.messageKey === "string" ? issue.messageKey : undefined
      });
    }
  }

  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    if (!issue.path) {
      continue;
    }

    const normalizedPath = toDotPath(issue.path);
    if (!(normalizedPath in fieldErrors)) {
      fieldErrors[normalizedPath] = issue.message;
    }
  }

  return {
    message:
      typeof payload.message === "string" && payload.message.trim().length > 0
        ? payload.message
        : error.message,
    fieldErrors,
    issues
  };
}

export function pickFieldError(
  fieldErrors: Record<string, string>,
  candidates: string[]
): string | null {
  for (const key of candidates) {
    const direct = fieldErrors[key];
    if (typeof direct === "string" && direct.trim().length > 0) {
      return direct;
    }
  }

  return null;
}
