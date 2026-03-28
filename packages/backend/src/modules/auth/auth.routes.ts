import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { AppEnv } from "../../config/env.js";
import { createAuthService } from "./createAuthService.js";
import { newPasswordSchema } from "../../utils/passwordPolicy.js";
import { authResponseSchema, errorSchema, successSchema } from "../../schemas/index.js";
import { prisma } from "../../db/prisma.js";
import { LOCAL_SESSION_COOKIE } from "../../config/constants.js";
import { AuthMode, EditionKey } from "@elms/shared";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const setupSchema = loginSchema.extend({
  firmName: z.string().min(2),
  fullName: z.string().min(2),
  password: newPasswordSchema,
  editionKey: z.nativeEnum(EditionKey)
});

export async function registerAuthRoutes(app: FastifyInstance, env: AppEnv) {
  const authService = createAuthService(app, env);
  const authOrDisabledResponses = { 200: authResponseSchema, 410: errorSchema } as const;

  app.post("/api/auth/login", { schema: { response: { 200: authResponseSchema } }, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const payload = loginSchema.parse(request.body);
    const response = await authService.login(payload);
    setCookies(reply, authService, response, env);
    request.sessionUser = response.session.user;
    return withLocalSessionToken(authService, response);
  });

  app.post("/api/auth/register", { schema: { response: authOrDisabledResponses }, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    return sendLocalOnlyCompatibilityError(reply, "Registration endpoint is unavailable in local-only deployments");
  });

  app.get("/api/auth/setup", async (_request, reply) => {
    const firm = await prisma.firm.findFirst({ select: { id: true } });
    return { needsSetup: !firm };
  });

  app.post("/api/auth/setup", { schema: { response: authOrDisabledResponses } }, async (request, reply) => {
    const payload = setupSchema.parse(request.body);
    if (!authService.setup) {
      return sendLocalOnlyCompatibilityError(reply, "Setup endpoint is unavailable");
    }
    const response = await authService.setup(payload);
    setCookies(reply, authService, response, env);
    request.sessionUser = response.session.user;
    return withLocalSessionToken(authService, response);
  });

  app.post("/api/auth/accept-invite", { schema: { response: authOrDisabledResponses } }, async (request, reply) => {
    return sendLocalOnlyCompatibilityError(reply, "Invite acceptance endpoint is unavailable in local-only deployments");
  });

  app.post("/api/auth/refresh", { schema: { response: authOrDisabledResponses } }, async (request, reply) => {
    return sendLocalOnlyCompatibilityError(reply, "Refresh endpoint is unavailable in local-only deployments");
  });

  app.post("/api/auth/logout", { schema: { response: { 200: successSchema } } }, async (request, reply) => {
    await authService.logout(request.cookies);
    clearCookies(reply, authService);
    request.sessionUser = null;
    return { success: true } as const;
  });

  app.get("/api/auth/me", { schema: { response: { 200: authResponseSchema } } }, async (request) => {
    return {
      session: {
        mode: AuthMode.LOCAL,
        user: request.sessionUser
      }
    };
  });
}

function sendLocalOnlyCompatibilityError(reply: FastifyReply, message: string) {
  return reply.status(410).send({
    message,
    code: "LOCAL_ONLY_DEPLOYMENT"
  });
}

function setCookies(
  reply: FastifyReply,
  authService: ReturnType<typeof createAuthService>,
  response: Awaited<ReturnType<typeof authService.login>>,
  env: AppEnv
) {
  const cookies = authService.getResponseCookies?.(response as never) ?? {};
  for (const [name, value] of Object.entries(cookies)) {
    reply.setCookie(name, value, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: env.NODE_ENV === "production"
    });
  }
}

function withLocalSessionToken<T extends { session: { mode: string } }>(
  authService: ReturnType<typeof createAuthService>,
  response: T
) {
  const cookies = authService.getResponseCookies?.(response as never) ?? {};
  return {
    ...response,
    localSessionToken: cookies[LOCAL_SESSION_COOKIE] ?? null
  };
}

function clearCookies(reply: FastifyReply, authService: ReturnType<typeof createAuthService>) {
  for (const name of authService.clearResponseCookies()) {
    reply.clearCookie(name, {
      path: "/"
    });
  }
}
