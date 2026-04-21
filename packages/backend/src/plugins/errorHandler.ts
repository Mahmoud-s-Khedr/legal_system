import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { captureBackendException } from "../monitoring/sentry.js";
import { isAppError } from "../errors/appError.js";

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
      return reply.status(400).send({
        message: "Validation failed",
        issues: error.issues
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
      return reply.status(error.statusCode).send({ message: error.message });
    }

    request.log.error(error);
    captureBackendException(error);

    return reply.status(500).send({
      message: "Internal server error"
    });
  });
}
