import type { AuditLog, Prisma } from "@prisma/client";
import type { RepositoryTx } from "../types.js";

export type DashboardRecentActivityRecord = Pick<AuditLog, "id" | "action" | "entityType" | "entityId" | "createdAt" | "userId">;

export async function listRecentAuditActivity(
  tx: RepositoryTx,
  firmId: string,
  input: { limit?: number; userIds?: string[] } = {}
): Promise<DashboardRecentActivityRecord[]> {
  const limit = input.limit ?? 10;
  const where: Prisma.AuditLogWhereInput = {
    firmId,
    ...(input.userIds && input.userIds.length > 0 ? { userId: { in: input.userIds } } : {})
  };

  return tx.auditLog.findMany({
    where,
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });
}
