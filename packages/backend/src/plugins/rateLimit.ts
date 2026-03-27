import rateLimit from "@fastify/rate-limit";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../config/env.js";

export async function registerRateLimitPlugin(app: FastifyInstance, env: AppEnv) {
  const isLocalMode = env.AUTH_MODE === "local";

  await app.register(rateLimit, {
    // Local desktop mode is single-user and chatty (calendar/notifications polling);
    // avoid user-facing throttling in that mode.
    max: isLocalMode ? 10_000 : 500,
    timeWindow: "1 minute",
    keyGenerator: (request) => {
      const sessionHeader = request.headers["x-elms-session"];
      const cookie = request.headers.cookie ?? "";
      if (typeof sessionHeader === "string" && sessionHeader.length > 0) {
        return `session:${sessionHeader}`;
      }
      if (cookie.length > 0) {
        return `cookie:${cookie}`;
      }
      return `ip:${request.ip}`;
    },
    allowList: (request) => {
      if (isLocalMode) {
        return true;
      }
      return request.url === "/api/health";
    }
  });
}
