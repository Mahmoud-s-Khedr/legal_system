import type { FastifyRequest } from "fastify";
import type { AuditContext } from "../services/audit.service.js";

export function getAuditContext(request: FastifyRequest): AuditContext {
  if (!request.sessionUser) {
    throw new Error("Authentication required");
  }

  return {
    actor: request.sessionUser,
    ipAddress: request.ip,
    userAgent: request.headers["user-agent"]
  };
}
