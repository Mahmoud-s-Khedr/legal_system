import type { FastifyReply, FastifyRequest } from "fastify";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.sessionUser) {
    await reply.status(401).send({ message: "Authentication required" });
    return;
  }
}
