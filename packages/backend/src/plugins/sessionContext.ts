import { AuthMode, type AccessTokenClaims } from "@elms/shared";
import type { VerifyOptions } from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { UserStatus } from "@prisma/client";
import { ACCESS_COOKIE, LOCAL_SESSION_COOKIE, LOCAL_SESSION_HEADER } from "../config/constants.js";
import type { AppEnv } from "../config/env.js";
import { prisma } from "../db/prisma.js";
import { localSessionStore } from "../modules/auth/localSessionStore.js";
import { getUserWithRoleAndPermissions, toSessionUser } from "../modules/auth/sessionUser.js";

export function registerSessionContext(app: FastifyInstance, env: AppEnv) {
  app.decorateRequest("sessionUser", null);

  app.addHook("preHandler", async (request) => {
    request.sessionUser = await resolveSessionUser(app, env, request.cookies, request.headers as Record<string, string | string[] | undefined>);
  });
}

async function resolveSessionUser(
  app: FastifyInstance,
  env: AppEnv,
  cookies: Record<string, string | undefined>,
  headers: Record<string, string | string[] | undefined>
) {
  if (env.AUTH_MODE === AuthMode.LOCAL) {
    const sessionIdFromCookie = cookies[LOCAL_SESSION_COOKIE];
    const sessionIdFromHeader = getHeaderValue(headers, LOCAL_SESSION_HEADER)
      ?? getAuthorizationBearer(headers);
    const session = localSessionStore.resolve(sessionIdFromCookie ?? sessionIdFromHeader);
    if (!session) {
      return null;
    }

    const user = await getUserWithRoleAndPermissions(prisma, session.userId);
    if (!user || user.deletedAt !== null || user.status !== UserStatus.ACTIVE) {
      localSessionStore.destroy(sessionIdFromCookie ?? sessionIdFromHeader);
      return null;
    }
    return toSessionUser(user);
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
    if (!user || user.deletedAt !== null || user.status !== UserStatus.ACTIVE) {
      return null;
    }
    return toSessionUser(user);
  } catch {
    return null;
  }
}

function getHeaderValue(
  headers: Record<string, string | string[] | undefined>,
  headerName: string
) {
  const value = headers[headerName.toLowerCase()];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

function getAuthorizationBearer(headers: Record<string, string | string[] | undefined>) {
  const raw = getHeaderValue(headers, "authorization");
  if (!raw) {
    return undefined;
  }

  const [scheme, token] = raw.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return undefined;
  }

  return token;
}
