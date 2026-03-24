import { randomUUID } from "node:crypto";
import { AuthMode, type AcceptInviteDto, type AuthResponseDto, type LoginDto, type RegisterDto } from "@elms/shared";
import type { SignOptions } from "@fastify/jwt";
import type { FastifyInstance } from "fastify";
import { InvitationStatus, Language, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { Redis } from "ioredis";
import type { AppEnv } from "../../config/env.js";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  SYSTEM_ROLE_KEYS
} from "../../config/constants.js";
import { prisma } from "../../db/prisma.js";
import { ensureSystemSecurityModel } from "../../security/bootstrap.js";
import type { AuthService } from "./auth.types.js";
import { toSessionUser, userWithRoleInclude } from "./sessionUser.js";

export function createCloudAuthService(app: FastifyInstance, env: AppEnv): AuthService {
  const redis = new Redis(env.REDIS_URL, {
    lazyConnect: true,
    maxRetriesPerRequest: 1
  });

  async function ensureRedis() {
    if (redis.status === "wait") {
      await redis.connect();
    }
  }

  async function issueTokens(userId: string) {
    await ensureRedis();

    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: userWithRoleInclude
    });
    const sessionUser = toSessionUser(user);
    const accessToken = await app.jwt.sign(
      {
        sub: sessionUser.id,
        firmId: sessionUser.firmId,
        editionKey: sessionUser.editionKey,
        lifecycleStatus: sessionUser.lifecycleStatus,
        trialEndsAt: sessionUser.trialEndsAt,
        graceEndsAt: sessionUser.graceEndsAt,
        roleId: sessionUser.roleId,
        roleKey: sessionUser.roleKey,
        email: sessionUser.email,
        permissions: sessionUser.permissions
      },
      {
        expiresIn: `${env.ACCESS_TOKEN_TTL_MINUTES}m`,
        aud: "elms-api",
        iss: env.COOKIE_DOMAIN
      } satisfies Partial<SignOptions>
    );

    const refreshToken = randomUUID();
    await redis.setex(
      `refresh:${refreshToken}`,
      env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
      userId
    );

    return {
      accessToken,
      refreshToken
    };
  }

  async function buildResponse(userId: string) {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: userId },
      include: userWithRoleInclude
    });

    return {
      session: {
        mode: AuthMode.CLOUD,
        user: toSessionUser(user)
      }
    } satisfies AuthResponseDto;
  }

  return {
    async register(payload: RegisterDto) {
      await ensureSystemSecurityModel(prisma);
      const role = await ensureSystemRole(SYSTEM_ROLE_KEYS.FIRM_ADMIN, "Firm Admin");
      const passwordHash = await bcrypt.hash(payload.password, 12);

      const user = await prisma.user.create({
        data: {
          email: payload.email,
          fullName: payload.fullName,
          passwordHash,
          preferredLanguage: Language.AR,
          status: UserStatus.ACTIVE,
          firm: {
            create: {
              name: payload.firmName,
              slug: slugify(payload.firmName),
              defaultLanguage: Language.AR,
              settings: {
                create: {
                  preferredLanguage: Language.AR,
                  timezone: "Africa/Cairo"
                }
              }
            }
          },
          role: {
            connect: {
              id: role.id
            }
          }
        }
      });

      const tokenBundle = await issueTokens(user.id);
      const response = await buildResponse(user.id);

      return withTokens(response, tokenBundle);
    },
    async acceptInvite(payload: AcceptInviteDto) {
      const invitation = await prisma.invitation.findFirst({
        where: {
          token: payload.token,
          status: InvitationStatus.PENDING,
          expiresAt: {
            gt: new Date()
          }
        }
      });

      if (!invitation) {
        throw new Error("Invitation is invalid or expired");
      }

      const user = await prisma.user.create({
        data: {
          firmId: invitation.firmId,
          roleId: invitation.roleId,
          email: invitation.email,
          fullName: payload.fullName,
          passwordHash: await bcrypt.hash(payload.password, 12),
          preferredLanguage: Language.AR,
          status: UserStatus.ACTIVE
        }
      });

      await prisma.invitation.update({
        where: { id: invitation.id },
        data: {
          acceptedAt: new Date(),
          status: InvitationStatus.ACCEPTED
        }
      });

      const tokenBundle = await issueTokens(user.id);
      const response = await buildResponse(user.id);
      return withTokens(response, tokenBundle);
    },
    async login(payload: LoginDto) {
      const user = await prisma.user.findFirst({
        where: {
          email: payload.email,
          deletedAt: null
        }
      });

      if (!user?.passwordHash) {
        throw new Error("Invalid email or password");
      }

      const matches = await bcrypt.compare(payload.password, user.passwordHash);
      if (!matches) {
        throw new Error("Invalid email or password");
      }

      const tokenBundle = await issueTokens(user.id);
      const response = await buildResponse(user.id);
      return withTokens(response, tokenBundle);
    },
    async refresh(requestCookies) {
      await ensureRedis();
      const refreshToken = requestCookies[REFRESH_COOKIE];
      if (!refreshToken) {
        throw new Error("Missing refresh token");
      }

      const userId = await redis.get(`refresh:${refreshToken}`);
      if (!userId) {
        throw new Error("Refresh token expired");
      }

      await redis.del(`refresh:${refreshToken}`);
      const tokenBundle = await issueTokens(userId);
      const response = await buildResponse(userId);
      return withTokens(response, tokenBundle);
    },
    async logout(requestCookies) {
      await ensureRedis();
      const refreshToken = requestCookies[REFRESH_COOKIE];
      if (refreshToken) {
        await redis.del(`refresh:${refreshToken}`);
      }
    },
    getResponseCookies(response) {
      const tokens = (response as AuthResponseDto & {
        __tokens?: { accessToken: string; refreshToken: string };
      }).__tokens;

      return response.session.user
        ? {
            [ACCESS_COOKIE]: tokens?.accessToken ?? "",
            [REFRESH_COOKIE]: tokens?.refreshToken ?? ""
          }
        : ({} as Record<string, string>);
    },
    clearResponseCookies() {
      return [ACCESS_COOKIE, REFRESH_COOKIE];
    }
  };
}

function withTokens<T extends AuthResponseDto>(
  response: T,
  tokens: { accessToken: string; refreshToken: string }
) {
  return Object.assign(response, {
    __tokens: tokens
  });
}

async function ensureSystemRole(key: string, name: string) {
  await ensureSystemSecurityModel(prisma);
  const existing = await prisma.role.findFirst({
    where: {
      firmId: null,
      key
    }
  });

  if (existing) {
    return existing;
  }

  return prisma.role.create({
    data: {
      key,
      name,
      scope: "SYSTEM"
    }
  });
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
