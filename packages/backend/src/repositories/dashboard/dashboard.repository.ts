import type { AuditLog } from "@prisma/client";
import type { RepositoryTx } from "../types.js";

export type DashboardRecentActivityRecord = Pick<AuditLog, "id" | "action" | "entityType" | "entityId" | "createdAt">;

export async function listRecentAuditActivity(
  tx: RepositoryTx,
  firmId: string,
  limit = 10
): Promise<DashboardRecentActivityRecord[]> {
  return tx.auditLog.findMany({
    where: {
      firmId
    },
    orderBy: {
      createdAt: "desc"
    },
    take: limit
  });
}
