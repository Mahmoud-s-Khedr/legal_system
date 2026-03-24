import type { FastifyInstance } from "fastify";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { captureBackendException } from "../monitoring/sentry.js";

export function registerErrorHandler(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        message: "Validation failed",
        issues: error.issues
      });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025") {
      return reply.status(404).send({ message: "Resource not found" });
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
      message: error instanceof Error ? error.message : "Internal server error"
    });
  });
}
