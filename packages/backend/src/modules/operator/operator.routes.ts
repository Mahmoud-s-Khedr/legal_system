import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { AppEnv } from "../../config/env.js";
import { OPERATOR_ACCESS_COOKIE } from "../../config/constants.js";
import { requireOperatorAuth } from "../../middleware/requireOperatorAuth.js";
import { createOperatorAuthService } from "./operatorAuthService.js";

const operatorLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export async function registerOperatorAuthRoutes(app: FastifyInstance, env: AppEnv) {
  const operatorAuthService = createOperatorAuthService(app, env);

  app.post(
    "/api/operator/auth/login",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const payload = operatorLoginSchema.parse(request.body);
      const { accessToken, operator } = await operatorAuthService.login(payload);

      reply.setCookie(OPERATOR_ACCESS_COOKIE, accessToken, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production"
      });
      request.operatorUser = operator;

      return { operator };
    }
  );

  app.post("/api/operator/auth/logout", async (request, reply) => {
    reply.clearCookie(OPERATOR_ACCESS_COOKIE, { path: "/" });
    request.operatorUser = null;
    return { success: true } as const;
  });

  app.get(
    "/api/operator/auth/me",
    { preValidation: [requireOperatorAuth] },
    async (request) => {
      return { operator: request.operatorUser };
    }
  );
}
