import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { captureBackendException } from "../monitoring/sentry.js";

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
      return reply.status(500).send({ message: "Internal server error" });
    }

    // Propagate explicit statusCode set by service layer (e.g. 409 conflict, 422 unsupported type)
    if (
      typeof error === "object" &&
      error !== null &&
      "statusCode" in error &&
      typeof error.statusCode === "number" &&
      error.statusCode < 500
    ) {
      const errorWithStatus = error as Error & { statusCode: number };
      return reply.status(errorWithStatus.statusCode).send({ message: errorWithStatus.message });
    }

    request.log.error(error);
    captureBackendException(error);

    return reply.status(500).send({
      message: "Internal server error"
    });
  });
}
