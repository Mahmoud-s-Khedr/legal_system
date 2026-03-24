import cookie from "@fastify/cookie";
import type { FastifyInstance } from "fastify";

export async function registerCookiePlugin(app: FastifyInstance) {
  await app.register(cookie);
}
