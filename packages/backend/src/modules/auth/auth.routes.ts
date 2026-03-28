import { z } from "zod";
import type { FastifyInstance, FastifyReply } from "fastify";
import type { AppEnv } from "../../config/env.js";
import { createAuthService } from "./createAuthService.js";
import { newPasswordSchema } from "../../utils/passwordPolicy.js";
import { authResponseSchema, errorSchema, successSchema } from "../../schemas/index.js";
import { prisma } from "../../db/prisma.js";
import { LOCAL_SESSION_COOKIE } from "../../config/constants.js";
import { EditionKey } from "@elms/shared";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

const registerSchema = loginSchema.extend({
  firmName: z.string().min(2),
  fullName: z.string().min(2),
  password: newPasswordSchema
});

const setupSchema = loginSchema.extend({
  firmName: z.string().min(2),
  fullName: z.string().min(2),
  password: newPasswordSchema,
  editionKey: z.nativeEnum(EditionKey)
});

const acceptInviteSchema = z.object({
  token: z.string().min(10),
  fullName: z.string().min(2),
  password: newPasswordSchema
});

export async function registerAuthRoutes(app: FastifyInstance, env: AppEnv) {
  const authService = createAuthService(app, env);
  const authOrDisabledResponses = { 200: authResponseSchema, 405: errorSchema } as const;

  app.post("/api/auth/login", { schema: { response: { 200: authResponseSchema } }, config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const payload = loginSchema.parse(request.body);
    const response = await authService.login(payload);
    setCookies(reply, authService, response, env);
    request.sessionUser = response.session.user;
    return withLocalSessionToken(authService, response);
  });

  app.post("/api/auth/register", { schema: { response: authOrDisabledResponses }, config: { rateLimit: { max: 5, timeWindow: "1 minute" } } }, async (request, reply) => {
    if (!authService.register) {
      return reply.status(405).send({ message: "Registration disabled in local mode" });
    }

    const payload = registerSchema.parse(request.body);
    const response = await authService.register(payload);
    setCookies(reply, authService, response, env);
    request.sessionUser = response.session.user;
    return withLocalSessionToken(authService, response);
  });

  app.get("/api/auth/setup", async (_request, reply) => {
    if (!authService.setup) {
      return reply.status(405).send({ message: "Setup only available in local mode" });
    }
    const firm = await prisma.firm.findFirst({ select: { id: true } });
    return { needsSetup: !firm };
  });

  app.post("/api/auth/setup", { schema: { response: authOrDisabledResponses } }, async (request, reply) => {
    if (!authService.setup) {
      return reply.status(405).send({ message: "Setup only available in local mode" });
    }

    const payload = setupSchema.parse(request.body);
    const response = await authService.setup(payload);
    setCookies(reply, authService, response, env);
    request.sessionUser = response.session.user;
    return withLocalSessionToken(authService, response);
  });

  app.post("/api/auth/accept-invite", { schema: { response: authOrDisabledResponses } }, async (request, reply) => {
    if (!authService.acceptInvite) {
      return reply.status(405).send({ message: "Invite acceptance disabled in local mode" });
    }

    const payload = acceptInviteSchema.parse(request.body);
    const response = await authService.acceptInvite(payload);
    setCookies(reply, authService, response, env);
    request.sessionUser = response.session.user;
    return withLocalSessionToken(authService, response);
  });

  app.post("/api/auth/refresh", { schema: { response: authOrDisabledResponses } }, async (request, reply) => {
    if (!authService.refresh) {
      return reply.status(405).send({ message: "Refresh disabled in local mode" });
    }

    const response = await authService.refresh(request.cookies);
    setCookies(reply, authService, response, env);
    request.sessionUser = response.session.user;
    return withLocalSessionToken(authService, response);
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
        mode: env.AUTH_MODE,
        user: request.sessionUser
      }
    };
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
