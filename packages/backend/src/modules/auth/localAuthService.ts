import { AuthMode, type AuthResponseDto, type LoginDto, type SetupDto } from "@elms/shared";
import { Language, Prisma, UserStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import type { AppEnv } from "../../config/env.js";
import { LOCAL_SESSION_COOKIE, SYSTEM_ROLE_KEYS } from "../../config/constants.js";
import { prisma } from "../../db/prisma.js";
import { ensureSystemSecurityModel } from "../../security/bootstrap.js";
import type { AuthService } from "./auth.types.js";
import { localSessionStore } from "./localSessionStore.js";
import { getUserWithRoleAndPermissions, toSessionUser } from "./sessionUser.js";

function httpError(message: string, statusCode: number): Error & { statusCode: number } {
  const err = new Error(message) as Error & { statusCode: number };
  err.statusCode = statusCode;
  return err;
}

function isP2002Error(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === "P2002";
  }
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

function p2002TargetsFirmSlug(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null ||
    !("meta" in error) ||
    typeof (error as { meta?: unknown }).meta !== "object" ||
    (error as { meta?: unknown }).meta === null
  ) {
    return false;
  }

  const target = (error as { meta?: { target?: unknown } }).meta?.target;
  if (Array.isArray(target)) {
    return target.some((entry) => String(entry).toLowerCase().includes("slug"));
  }
  if (typeof target === "string") {
    return target.toLowerCase().includes("slug");
  }
  return false;
}

export function createLocalAuthService(_env: AppEnv): AuthService {
  void _env;
  return {
    async setup(payload: SetupDto) {
      await ensureSystemSecurityModel(prisma);
      const existingFirm = await prisma.firm.findFirst();
      if (existingFirm) {
        throw httpError("Desktop setup already completed", 409);
      }

      const [adminRole] = await ensureSystemRoles();
      const passwordHash = await bcrypt.hash(payload.password, 12);

      const slug = slugify(payload.firmName);
      let firm: { users: Array<{ id: string }> };
      try {
        firm = await prisma.firm.create({
          data: {
            name: payload.firmName,
            slug,
            editionKey: payload.editionKey,
            defaultLanguage: Language.AR,
            users: {
              create: {
                email: payload.email,
                fullName: payload.fullName,
                passwordHash,
                preferredLanguage: Language.AR,
                roleId: adminRole.id,
                status: UserStatus.ACTIVE
              }
            },
            settings: {
              create: {
                preferredLanguage: Language.AR,
                timezone: "Africa/Cairo"
              }
            }
          },
          select: { users: { select: { id: true } } }
        });
      } catch (error) {
        if (isP2002Error(error) && p2002TargetsFirmSlug(error)) {
          const alreadyExists = await prisma.firm.findFirst({ where: { slug } });
          if (alreadyExists) {
            throw httpError("Desktop setup already completed", 409);
          }
        }
        throw error;
      }

      const userId = firm.users[0].id;
      const user = await getUserWithRoleAndPermissions(prisma, userId);
      if (!user) throw new Error("Failed to load created user");
      const sessionId = localSessionStore.create(userId);

      return Object.assign({
        session: {
          mode: AuthMode.LOCAL,
          user: toSessionUser(user)
        }
      }, { __localSessionId: sessionId });
    },
    async login(payload: LoginDto) {
      const candidate = await prisma.user.findFirst({
        where: { email: payload.email, deletedAt: null },
        select: { id: true, passwordHash: true }
      });

      if (!candidate?.passwordHash) {
        throw httpError("Invalid email or password", 401);
      }

      const isValid = await bcrypt.compare(payload.password, candidate.passwordHash);
      if (!isValid) {
        throw httpError("Invalid email or password", 401);
      }

      const user = await getUserWithRoleAndPermissions(prisma, candidate.id);
      if (!user) throw httpError("Invalid email or password", 401);

      const sessionId = localSessionStore.create(candidate.id);

      return Object.assign({
        session: {
          mode: AuthMode.LOCAL,
          user: toSessionUser(user)
        }
      }, { __localSessionId: sessionId });
    },
    async logout(requestCookies) {
      localSessionStore.destroy(requestCookies[LOCAL_SESSION_COOKIE]);
    },
    getResponseCookies(_response: AuthResponseDto) {
      const sessionId = (_response as AuthResponseDto & { __localSessionId?: string })
        .__localSessionId;
      return sessionId
        ? { [LOCAL_SESSION_COOKIE]: sessionId }
        : ({} as Record<string, string>);
    },
    clearResponseCookies() {
      return [LOCAL_SESSION_COOKIE];
    }
  };
}

async function ensureSystemRoles() {
  await ensureSystemSecurityModel(prisma);
  let firmAdmin = await prisma.role.findFirst({
    where: {
      firmId: null,
      key: SYSTEM_ROLE_KEYS.FIRM_ADMIN
    }
  });

  if (!firmAdmin) {
    firmAdmin = await prisma.role.create({
      data: {
        key: SYSTEM_ROLE_KEYS.FIRM_ADMIN,
        name: "Firm Admin",
        scope: "SYSTEM"
      }
    });
  }

  return [firmAdmin];
}

function slugify(input: string) {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
