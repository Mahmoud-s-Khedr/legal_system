import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { captureBackendException } from "../monitoring/sentry.js";
import { isAppError } from "../errors/appError.js";

type ValidationMessageKey =
  | "VALIDATION_REQUIRED"
  | "VALIDATION_INVALID_TYPE"
  | "VALIDATION_INVALID_UUID"
  | "VALIDATION_INVALID_EMAIL"
  | "VALIDATION_INVALID_DATE"
  | "VALIDATION_INVALID_DATETIME"
  | "VALIDATION_INVALID_STRING_FORMAT"
  | "VALIDATION_INVALID_ENUM"
  | "VALIDATION_TOO_SMALL"
  | "VALIDATION_TOO_BIG"
  | "VALIDATION_INVALID_VALUE";

type ValidationIssueParams = Partial<{
  minimum: number;
  maximum: number;
  inclusive: boolean;
  exact: boolean;
  expected: string;
  received: string;
  format: string;
  origin: string;
}>;

type ValidationIssuePayload = {
  path: string;
  pathSegments: Array<string | number>;
  code: string;
  message: string;
  messageKey: ValidationMessageKey;
  params?: ValidationIssueParams;
};

function toValidationNumber(value: number | bigint): number | undefined {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }

  const asNumber = Number(value);
  return Number.isSafeInteger(asNumber) ? asNumber : undefined;
}

function normalizePathSegments(path: readonly PropertyKey[]): Array<string | number> {
  return path
    .filter((segment): segment is string | number =>
      typeof segment === "string" || typeof segment === "number"
    );
}

function formatValidationPath(path: Array<string | number>): string {
  return path
    .map((segment) =>
      typeof segment === "number" ? `[${segment}]` : String(segment)
    )
    .join(".")
    .replace(/\.\[/g, "[");
}

function formatValidationIssue(issue: ZodError["issues"][number]): ValidationIssuePayload {
  const pathSegments = normalizePathSegments(issue.path);
  const path = formatValidationPath(pathSegments);

  if (issue.code === "invalid_type") {
    const required = issue.input === undefined || issue.input === null;
    return {
      path,
      pathSegments,
      code: issue.code,
      message: required ? "This field is required." : "The provided value has an invalid type.",
      messageKey: required ? "VALIDATION_REQUIRED" : "VALIDATION_INVALID_TYPE",
      params: required
        ? undefined
        : {
            expected: String(issue.expected ?? ""),
            received: String(issue.input === null ? "null" : typeof issue.input)
          }
    };
  }

  if (issue.code === "too_small") {
    const minimum = toValidationNumber(issue.minimum);

    if (issue.origin === "string") {
      const required = issue.minimum === 1 || issue.minimum === 1n;
      return {
        path,
        pathSegments,
        code: issue.code,
        message: required
          ? "This field is required."
          : `Must be at least ${issue.minimum} characters.`,
        messageKey: required ? "VALIDATION_REQUIRED" : "VALIDATION_TOO_SMALL",
        params: required
          ? undefined
          : {
              minimum,
              inclusive: issue.inclusive,
              exact: issue.exact,
              origin: issue.origin
            }
      };
    }

    return {
      path,
      pathSegments,
      code: issue.code,
      message: "Value is below the allowed minimum.",
      messageKey: "VALIDATION_TOO_SMALL",
      params: {
        minimum,
        inclusive: issue.inclusive,
        exact: issue.exact,
        origin: issue.origin
      }
    };
  }

  if (issue.code === "too_big") {
    const maximum = toValidationNumber(issue.maximum);

    return {
      path,
      pathSegments,
      code: issue.code,
      message: "Value exceeds the allowed maximum.",
      messageKey: "VALIDATION_TOO_BIG",
      params: {
        maximum,
        inclusive: issue.inclusive,
        exact: issue.exact,
        origin: issue.origin
      }
    };
  }

  if (issue.code === "invalid_format") {
    const validationName = issue.format;

    if (validationName === "uuid") {
      return {
        path,
        pathSegments,
        code: issue.code,
        message: "Enter a valid identifier.",
        messageKey: "VALIDATION_INVALID_UUID",
        params: { format: validationName }
      };
    }

    if (validationName === "email") {
      return {
        path,
        pathSegments,
        code: issue.code,
        message: "Enter a valid email address.",
        messageKey: "VALIDATION_INVALID_EMAIL",
        params: { format: validationName }
      };
    }

    if (validationName === "date") {
      return {
        path,
        pathSegments,
        code: issue.code,
        message: "Enter a valid date.",
        messageKey: "VALIDATION_INVALID_DATE",
        params: { format: validationName }
      };
    }

    if (validationName === "datetime") {
      return {
        path,
        pathSegments,
        code: issue.code,
        message: "Enter a valid date and time.",
        messageKey: "VALIDATION_INVALID_DATETIME",
        params: { format: validationName }
      };
    }

    return {
      path,
      pathSegments,
      code: issue.code,
      message: "Invalid format.",
      messageKey: "VALIDATION_INVALID_STRING_FORMAT",
      params: { format: validationName }
    };
  }

  if (issue.code === "invalid_value") {
    return {
      path,
      pathSegments,
      code: issue.code,
      message: "Choose a valid option.",
      messageKey: "VALIDATION_INVALID_ENUM",
      params: {
        expected: Array.isArray(issue.values) ? issue.values.join(", ") : undefined
      }
    };
  }

  return {
    path,
    pathSegments,
    code: issue.code,
    message: issue.message || "Invalid value.",
    messageKey: "VALIDATION_INVALID_VALUE"
  };
}

function formatValidationIssues(error: ZodError): ValidationIssuePayload[] {
  return error.issues.map((issue) => formatValidationIssue(issue));
}

function getPrismaErrorCode(error: unknown): string | null {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code;
  }
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && typeof error.message === "string") {
    return error.message;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return "";
}

function isDatabaseUnavailableError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("can't reach database server") ||
    message.includes("database server at") ||
    message.includes("connection refused") ||
    message.includes("timed out")
  );
}

function isSchemaMismatchError(error: unknown): boolean {
  const prismaCode = getPrismaErrorCode(error);
  if (prismaCode === "P2021" || prismaCode === "P2022") {
    return true;
  }

  const message = getErrorMessage(error).toLowerCase();
  return (
    message.includes("column") && message.includes("does not exist") ||
    message.includes("relation") && message.includes("does not exist") ||
    message.includes("table") && message.includes("does not exist")
  );
}

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      const issues = formatValidationIssues(error);
      return reply.status(400).send({
        message: "Please review the highlighted fields and try again.",
        messageKey: "VALIDATION_SUMMARY",
        code: "VALIDATION_ERROR",
        issues
      });
    }

    const prismaCode = getPrismaErrorCode(error);

    if (prismaCode === "P2025") {
      return reply.status(404).send({ message: "Resource not found" });
    }
    if (prismaCode === "P2002") {
      request.log.warn({ err: error }, "Prisma unique constraint violation");
      return reply.status(409).send({ message: "Resource already exists" });
    }
    if (prismaCode === "P2010") {
      request.log.error({ err: error }, "Prisma raw query failed");
      captureBackendException(error);
      if (isSchemaMismatchError(error)) {
        return reply.status(503).send({
          message: "Database schema mismatch. Run migrations and retry.",
          code: "DATABASE_SCHEMA_MISMATCH"
        });
      }
      return reply.status(500).send({ message: "Internal server error" });
    }

    if (isDatabaseUnavailableError(error)) {
      request.log.error({ err: error }, "Database unavailable");
      captureBackendException(error);
      return reply.status(503).send({
        message: "Database unavailable",
        code: "DATABASE_UNAVAILABLE"
      });
    }

    if (isSchemaMismatchError(error)) {
      request.log.error({ err: error }, "Database schema mismatch detected");
      captureBackendException(error);
      return reply.status(503).send({
        message: "Database schema mismatch. Run migrations and retry.",
        code: "DATABASE_SCHEMA_MISMATCH"
      });
    }

    if (isAppError(error) && error.statusCode < 500) {
      if (error.code === "VALIDATION_ERROR") {
        const details =
          typeof error.details === "object" && error.details !== null
            ? (error.details as Record<string, unknown>)
            : {};
        return reply.status(error.statusCode).send({
          message: error.message,
          messageKey: "VALIDATION_SUMMARY",
          code: "VALIDATION_ERROR",
          ...details
        });
      }
      return reply.status(error.statusCode).send({ message: error.message });
    }

    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof (error as { statusCode?: unknown }).statusCode === "number"
    ) {
      const statusCode = (error as { statusCode: number }).statusCode;
      if (statusCode >= 400 && statusCode < 500) {
        const message = getErrorMessage(error) || "Bad request";
        return reply.status(statusCode).send({ message });
      }
    }

    request.log.error(error);
    captureBackendException(error);

    return reply.status(500).send({
      message: "Internal server error"
    });
  });
}
