import type { FastifyReply, FastifyRequest } from "fastify";

export function requirePermission(permission: string) {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.sessionUser) {
      return reply.status(401).send({ message: "Authentication required" });
    }

    if (!request.sessionUser.permissions.includes(permission)) {
      return reply.status(403).send({ message: "Forbidden" });
    }
  };
}
