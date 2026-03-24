import type { DashboardSummaryDto, SessionUser } from "@elms/shared";
import { prisma } from "../../db/prisma.js";
import { withTenant } from "../../db/tenant.js";
import { listHearings } from "../hearings/hearings.service.js";
import { listTasks } from "../tasks/tasks.service.js";

export async function getDashboardSummary(actor: SessionUser): Promise<DashboardSummaryDto> {
  const upcomingHearings = await listHearings(actor, {}, { page: 1, limit: 20 });
  const overdueTasks = await listTasks(actor, { overdue: "true" }, { page: 1, limit: 20 });

  const recentActivity = await withTenant(prisma, actor.firmId, async (tx) => {
    const logs = await tx.auditLog.findMany({
      where: {
        firmId: actor.firmId
      },
      orderBy: {
        createdAt: "desc"
      },
      take: 10
    });

    return logs.map((log) => ({
      id: log.id,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId ?? null,
      createdAt: log.createdAt.toISOString()
    }));
  });

  return {
    upcomingHearings: upcomingHearings.items.slice(0, 5),
    overdueTasks: overdueTasks.items.slice(0, 5),
    recentActivity
  };
}
