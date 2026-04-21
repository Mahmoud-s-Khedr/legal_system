import { Language, type Prisma, UserStatus, type User } from "@prisma/client";
import type { CreateLocalUserDto, UpdateUserDto } from "@elms/shared";
import { userWithRoleInclude, type UserWithRole } from "../../modules/auth/sessionUser.js";
import type { RepositoryTx } from "../types.js";
import { buildFuzzySearchCandidates } from "../../utils/fuzzySearch.js";

export type UserListQuery = {
  q?: string;
  status?: string;
  roleId?: string;
  sortBy: "fullName" | "email" | "createdAt" | "status";
  sortDir: Prisma.SortOrder;
  page: number;
  limit: number;
};

export async function listFirmUsers(
  tx: RepositoryTx,
  firmId: string,
  query: UserListQuery
): Promise<{ total: number; items: UserWithRole[] }> {
  const q = query.q?.trim();
  const searchCandidates = buildFuzzySearchCandidates(q);
  const where: Prisma.UserWhereInput = {
    firmId,
    deletedAt: null,
    ...(query.status ? { status: query.status as UserStatus } : {}),
    ...(query.roleId ? { roleId: query.roleId } : {}),
    ...(searchCandidates.length > 0
      ? {
          OR: searchCandidates.flatMap((candidate) => [
            { fullName: { contains: candidate, mode: "insensitive" as const } },
            { email: { contains: candidate, mode: "insensitive" as const } }
          ])
        }
      : {})
  };

  const [total, items] = await Promise.all([
    tx.user.count({ where }),
    tx.user.findMany({
      where,
      include: userWithRoleInclude,
      orderBy: { [query.sortBy]: query.sortDir },
      skip: (query.page - 1) * query.limit,
      take: query.limit
    })
  ]);

  return { total, items };
}

export async function getFirmActiveUserByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  userId: string
): Promise<UserWithRole> {
  return tx.user.findFirstOrThrow({
    where: {
      id: userId,
      firmId,
      deletedAt: null
    },
    include: userWithRoleInclude
  });
}

export async function getFirmActiveUserRowByIdOrThrow(
  tx: RepositoryTx,
  firmId: string,
  userId: string
): Promise<User> {
  return tx.user.findFirstOrThrow({
    where: {
      id: userId,
      firmId,
      deletedAt: null
    }
  });
}

export async function createFirmUser(
  tx: RepositoryTx,
  firmId: string,
  payload: CreateLocalUserDto,
  passwordHash: string
): Promise<UserWithRole> {
  return tx.user.create({
    data: {
      firmId,
      roleId: payload.roleId,
      email: payload.email,
      fullName: payload.fullName,
      passwordHash,
      preferredLanguage: (payload.preferredLanguage as Language | undefined) ?? Language.AR,
      status: UserStatus.ACTIVE
    },
    include: userWithRoleInclude
  });
}

export async function updateFirmUserById(
  tx: RepositoryTx,
  userId: string,
  payload: UpdateUserDto,
  options: {
    roleId: string;
    status: UserStatus;
  }
): Promise<UserWithRole> {
  return tx.user.update({
    where: { id: userId },
    data: {
      fullName: payload.fullName,
      email: payload.email,
      roleId: options.roleId,
      preferredLanguage: (payload.preferredLanguage as Language | undefined) ?? Language.AR,
      status: options.status
    },
    include: userWithRoleInclude
  });
}

export async function updateUserPasswordHashById(
  tx: RepositoryTx,
  userId: string,
  passwordHash: string
): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: { passwordHash }
  });
}

export async function updateFirmUserStatusById(
  tx: RepositoryTx,
  userId: string,
  status: UserStatus
): Promise<UserWithRole> {
  return tx.user.update({
    where: { id: userId },
    data: { status },
    include: userWithRoleInclude
  });
}

export async function softDeleteUserById(tx: RepositoryTx, userId: string): Promise<void> {
  await tx.user.update({
    where: { id: userId },
    data: {
      status: UserStatus.SUSPENDED,
      deletedAt: new Date()
    }
  });
}
