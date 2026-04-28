import type { DashboardSummaryDto, SessionUser } from "@elms/shared";
import { loadEnv } from "../../config/env.js";
import { listHearings } from "../hearings/hearings.service.js";
import { listTasks } from "../tasks/tasks.service.js";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import { listRecentAuditActivity } from "../../repositories/dashboard/dashboard.repository.js";

type CachedSummary = { expiresAt: number; value: DashboardSummaryDto };
const dashboardCache = new Map<string, CachedSummary>();

export async function getDashboardSummary(actor: SessionUser): Promise<DashboardSummaryDto> {
  const env = loadEnv();
  const cacheKey = `${actor.firmId}:${actor.id}`;
  const now = Date.now();
  const cached = dashboardCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  const [upcomingHearings, overdueTasks, recentActivity] = await Promise.all([
    listHearings(actor, {}, { page: 1, limit: 5 }),
    listTasks(actor, { overdue: "true" }, { page: 1, limit: 5 }),
    inTenantTransaction(actor.firmId, async (tx) => {
      const logs = await listRecentAuditActivity(tx, actor.firmId, 10);
      return logs.map((log) => ({
        id: log.id,
        action: log.action,
        entityType: log.entityType,
        entityId: log.entityId ?? null,
        createdAt: log.createdAt.toISOString()
      }));
    })
  ]);

  const value: DashboardSummaryDto = {
    upcomingHearings: upcomingHearings.items,
    overdueTasks: overdueTasks.items,
    recentActivity
  };

  dashboardCache.set(cacheKey, {
    value,
    expiresAt: now + env.DASHBOARD_CACHE_TTL_MS
  });

  return value;
}
