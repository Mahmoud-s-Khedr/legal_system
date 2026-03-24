import type { SessionUser } from "@elms/shared";
import type { Prisma, PrismaClient } from "@prisma/client";

export const userWithRoleInclude = {
  firm: {
    select: {
      editionKey: true,
      lifecycleStatus: true,
      trialEndsAt: true,
      graceEndsAt: true
    }
  },
  role: {
    include: {
      permissions: {
        include: {
          permission: true
        }
      }
    }
  }
} satisfies Prisma.UserInclude;

export type UserWithRole = Prisma.UserGetPayload<{
  include: typeof userWithRoleInclude;
}>;

export async function getUserWithRoleAndPermissions(
  prisma: PrismaClient | Prisma.TransactionClient,
  userId: string
) {
  return prisma.user.findUnique({
    where: { id: userId },
    include: userWithRoleInclude
  });
}

export function toSessionUser(user: UserWithRole): SessionUser {
  return {
    id: user.id,
    firmId: user.firmId,
    editionKey: user.firm.editionKey as SessionUser["editionKey"],
    lifecycleStatus: user.firm.lifecycleStatus as SessionUser["lifecycleStatus"],
    trialEndsAt: user.firm.trialEndsAt?.toISOString() ?? null,
    graceEndsAt: user.firm.graceEndsAt?.toISOString() ?? null,
    roleId: user.roleId,
    roleKey: user.role.key,
    email: user.email,
    fullName: user.fullName,
    preferredLanguage: user.preferredLanguage,
    permissions: user.role.permissions.map((item) => item.permission.key)
  };
}
