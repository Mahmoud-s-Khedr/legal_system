import { AuthMode, type AccessTokenClaims } from "@elms/shared";
import type { VerifyOptions } from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { ACCESS_COOKIE, LOCAL_SESSION_COOKIE } from "../config/constants.js";
import type { AppEnv } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { localSessionStore } from "../modules/auth/localSessionStore.js";
import { getUserWithRoleAndPermissions, toSessionUser } from "../modules/auth/sessionUser.js";

export function registerSessionContext(app: FastifyInstance, env: AppEnv) {
  app.decorateRequest("sessionUser", null);

  app.addHook("preHandler", async (request) => {
    request.sessionUser = await resolveSessionUser(app, env, request.cookies);
  });
}

async function resolveSessionUser(
  app: FastifyInstance,
  env: AppEnv,
  cookies: Record<string, string | undefined>
) {
  if (env.AUTH_MODE === AuthMode.LOCAL) {
    const session = localSessionStore.resolve(cookies[LOCAL_SESSION_COOKIE]);
    if (!session) {
      return null;
    }

    const user = await getUserWithRoleAndPermissions(prisma, session.userId);
    return user ? toSessionUser(user) : null;
  }

  const accessToken = cookies[ACCESS_COOKIE];
  if (!accessToken) {
    return null;
  }

  try {
    const claims = await app.jwt.verify<AccessTokenClaims>(accessToken, {
      allowedAud: "elms-api",
      allowedIss: env.COOKIE_DOMAIN
    } satisfies Partial<VerifyOptions>);
    const user = await getUserWithRoleAndPermissions(prisma, claims.sub);
    return user ? toSessionUser(user) : null;
  } catch {
    return null;
  }
}
