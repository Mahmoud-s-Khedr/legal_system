import type { DashboardSummaryDto, SessionUser } from "@elms/shared";
import { listHearings } from "../hearings/hearings.service.js";
import { listTasks } from "../tasks/tasks.service.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import { listRecentAuditActivity } from "../../repositories/dashboard/dashboard.repository.js";

export async function getDashboardSummary(actor: SessionUser): Promise<DashboardSummaryDto> {
  const upcomingHearings = await listHearings(actor, {}, { page: 1, limit: 20 });
  const overdueTasks = await listTasks(actor, { overdue: "true" }, { page: 1, limit: 20 });

  const recentActivity = await inTenantTransaction(actor.firmId, async (tx) => {
    const logs = await listRecentAuditActivity(tx, actor.firmId, 10);

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
