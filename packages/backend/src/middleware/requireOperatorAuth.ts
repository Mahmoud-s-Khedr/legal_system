import type { FastifyReply, FastifyRequest } from "fastify";
import { OPERATOR_ACCESS_COOKIE } from "../config/constants.js";

export async function requireOperatorAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.operatorUser) {
    if (typeof reply.clearCookie === "function") {
      reply.clearCookie(OPERATOR_ACCESS_COOKIE, { path: "/" });
    }
    await reply.status(401).send({ message: "Operator authentication required" });
  }
}
