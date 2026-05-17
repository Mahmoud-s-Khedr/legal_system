import type { FastifyReply, FastifyRequest } from "fastify";
import { ACCESS_COOKIE, LOCAL_SESSION_COOKIE, REFRESH_COOKIE } from "../config/constants.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  if (!request.sessionUser) {
    if (typeof reply.clearCookie === "function") {
      reply.clearCookie(LOCAL_SESSION_COOKIE, { path: "/" });
      reply.clearCookie(ACCESS_COOKIE, { path: "/" });
      reply.clearCookie(REFRESH_COOKIE, { path: "/" });
    }
    await reply.status(401).send({ message: "Authentication required" });
    return;
  }
}
