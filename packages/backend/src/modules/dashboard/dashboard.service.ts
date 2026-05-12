import type {
  DashboardAnalyticsResponseDto,
  DashboardChartDto,
  DashboardChartPointDto,
  DashboardRange,
  DashboardResponseDto,
  DashboardScope,
  DashboardSummaryDto,
  DashboardWorkItemDto,
  SessionUser
} from "@elms/shared";
import { Prisma, TaskStatus } from "@prisma/client";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import {
  queryEarningsLossesReport,
  queryRevenueReport
} from "../../repositories/reports/reports.repository.js";
import { resolveDashboardChartRules } from "./dashboard.registry.js";

function startDateForRange(range: DashboardRange): Date {
  const days = range === "90d" ? 90 : 30;
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
}

function titleCaseRole(roleKey: string) {
  return roleKey
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildAppHref(path: string, params: Record<string, string | null | undefined>) {
  const search = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value && value.trim().length > 0) {
      search.set(key, value);
    }
  }

  const query = search.toString();
  return query ? `${path}?${query}` : path;
}

async function resolveScopeContext(tx: Prisma.TransactionClient, actor: SessionUser, scope: DashboardScope) {
  if (scope === "office") {
    return { caseIds: null as string[] | null, userIds: null as string[] | null };
  }

  const actorAssignments = await tx.caseAssignment.findMany({
    where: { userId: actor.id, unassignedAt: null, assignedCase: { firmId: actor.firmId, deletedAt: null } },
    select: { caseId: true }
  });

  const caseIds = [...new Set(actorAssignments.map((a) => a.caseId))];

  if (scope === "my") {
    return { caseIds, userIds: [actor.id] };
  }

  if (caseIds.length === 0) {
    return { caseIds: [], userIds: [actor.id] };
  }

  const teamAssignments = await tx.caseAssignment.findMany({
    where: {
      caseId: { in: caseIds },
      unassignedAt: null,
      user: { firmId: actor.firmId, deletedAt: null }
    },
    select: { userId: true }
  });

  const userIds = [...new Set([actor.id, ...teamAssignments.map((a) => a.userId)])];
  return { caseIds, userIds };
}

function buildTaskWhere(actor: SessionUser, scope: DashboardScope, context: { caseIds: string[] | null }) {
  const base: Prisma.TaskWhereInput = {
    firmId: actor.firmId,
    deletedAt: null
  };

  if (scope === "office") {
    return base;
  }

  if (scope === "my") {
    return {
      ...base,
      OR: [
        { assignedToId: actor.id },
        { createdById: actor.id },
        ...(context.caseIds && context.caseIds.length > 0 ? [{ caseId: { in: context.caseIds } }] : [])
      ]
    };
  }

  return {
    ...base,
    OR: [
      ...(context.caseIds && context.caseIds.length > 0 ? [{ caseId: { in: context.caseIds } }] : []),
      { assignedToId: actor.id }
    ]
  };
}

function buildHearingWhere(actor: SessionUser, scope: DashboardScope, context: { caseIds: string[] | null }) {
  const base: Prisma.CaseSessionWhereInput = {
    deletedAt: null,
    case: { firmId: actor.firmId, deletedAt: null }
  };

  if (scope === "office") {
    return base;
  }

  if (scope === "my") {
    return {
      ...base,
      OR: [
        { assignedLawyerId: actor.id },
        ...(context.caseIds && context.caseIds.length > 0 ? [{ caseId: { in: context.caseIds } }] : [])
      ]
    };
  }

  return {
    ...base,
    ...(context.caseIds && context.caseIds.length > 0 ? { caseId: { in: context.caseIds } } : { assignedLawyerId: actor.id })
  };
}

export async function getDashboard(actor: SessionUser, scope: DashboardScope): Promise<DashboardResponseDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const scopeContext = await resolveScopeContext(tx, actor, scope);
    const taskWhere = buildTaskWhere(actor, scope, scopeContext);
    const hearingWhere = buildHearingWhere(actor, scope, scopeContext);
    const now = new Date();
    const weekAhead = new Date(now);
    weekAhead.setDate(now.getDate() + 7);

    const dueTodayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const dueTodayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);

    const [dueToday, overdue, hearings7d, unassigned, upcomingTasks, upcomingHearings] = await Promise.all([
      tx.task.count({
        where: {
          ...taskWhere,
          dueAt: { gte: dueTodayStart, lt: dueTodayEnd },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
        }
      }),
      tx.task.count({
        where: {
          ...taskWhere,
          dueAt: { lt: now },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
        }
      }),
      tx.caseSession.count({
        where: {
          ...hearingWhere,
          sessionDatetime: { gte: now, lte: weekAhead }
        }
      }),
      tx.task.count({
        where: {
          ...taskWhere,
          assignedToId: null,
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
        }
      }),
      tx.task.findMany({
        where: {
          ...taskWhere,
          dueAt: { gte: now },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
        },
        include: {
          case: { select: { id: true, title: true } }
        },
        orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
        take: 2
      }),
      tx.caseSession.findMany({
        where: {
          ...hearingWhere,
          sessionDatetime: { gte: now }
        },
        include: { case: { select: { id: true, title: true } } },
        orderBy: { sessionDatetime: "asc" },
        take: 2
      })
    ]);

    const priorityCards: DashboardResponseDto["priorityCards"] = [
      {
        key: "dueToday",
        label: "Due today",
        value: dueToday,
        href: buildAppHref("/app/tasks", {
          open: "true",
          from: dueTodayStart.toISOString(),
          to: dueTodayEnd.toISOString()
        })
      },
      { key: "overdue", label: "Overdue", value: overdue, href: buildAppHref("/app/tasks", { overdue: "true" }) },
      {
        key: "hearings7d",
        label: "Hearings in 7 days",
        value: hearings7d,
        href: buildAppHref("/app/hearings", {
          from: now.toISOString(),
          to: weekAhead.toISOString()
        })
      },
      {
        key: "unassigned",
        label: "Unassigned",
        value: unassigned,
        href: buildAppHref("/app/tasks", { assignedToId: "unassigned", open: "true" })
      }
    ];

    const taskItems: DashboardWorkItemDto[] = upcomingTasks.map((task) => ({
      id: task.id,
      type: "task",
      title: task.title,
      subtitle: task.case?.title ?? "General task",
      dueAt: task.dueAt?.toISOString() ?? null,
      href: `/app/tasks/${task.id}`,
      priority: task.priority.toLowerCase() as DashboardWorkItemDto["priority"]
    }));

    const hearingItems: DashboardWorkItemDto[] = upcomingHearings.map((hearing) => ({
      id: hearing.id,
      type: "hearing",
      title: hearing.case.title,
      subtitle: "Hearing",
      dueAt: hearing.sessionDatetime.toISOString(),
      href: `/app/hearings/${hearing.id}/edit`,
      priority: "high"
    }));

    return {
      scope,
      roleLabel: titleCaseRole(actor.roleKey),
      widgets: [],
      priorityCards,
      upcomingTasks: taskItems,
      upcomingSessions: hearingItems,
      recentActivity: []
    };
  });
}

function finalizeChart(chart: Omit<DashboardChartDto, "emptyReason">): DashboardChartDto {
  if (chart.points.length > 0) {
    return chart;
  }

  return {
    ...chart,
    emptyReason: chart.redacted ? "suppressed" : "no_data"
  };
}

export async function getDashboardAnalytics(
  actor: SessionUser,
  scope: DashboardScope,
  range: DashboardRange
): Promise<DashboardAnalyticsResponseDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const rules = resolveDashboardChartRules(actor, scope);
    const scopeContext = await resolveScopeContext(tx, actor, scope);
    const now = new Date();
    const startDate = startDateForRange(range);

    const chartByKey = new Map<string, DashboardChartDto>();

    if (rules.some((r) => r.key === "financeTrend")) {
      const [revenueRows, earningsRows] = await Promise.all([
        queryRevenueReport(
          tx,
          actor.firmId,
          { dateFrom: startDate.toISOString(), dateTo: now.toISOString() },
          { caseIds: scope === "office" ? null : scopeContext.caseIds }
        ),
        queryEarningsLossesReport(
          tx,
          actor.firmId,
          { dateFrom: startDate.toISOString(), dateTo: now.toISOString() },
          { caseIds: scope === "office" ? null : scopeContext.caseIds }
        )
      ]);

      const revenueByMonth = new Map(revenueRows.map((row) => [row.month, Number(row.invoiced)]));
      const points: DashboardChartPointDto[] = earningsRows.map((row) => ({
        label: row.month,
        values: {
          revenue: revenueByMonth.get(row.month) ?? 0,
          expenses: Number(row.operatingExpenses),
          profit: Number(row.netProfitAccrual)
        }
      }));

      chartByKey.set("financeTrend", finalizeChart({
        key: "financeTrend",
        title: "Revenue, profit, and expenses",
        series: [{ key: "revenue" }, { key: "profit" }, { key: "expenses" }],
        points,
        redacted: false,
        valueFormat: "currency"
      }));
    }

    return {
      scope,
      range,
      charts: rules
        .map((rule) => chartByKey.get(rule.key))
        .filter((chart): chart is DashboardChartDto => Boolean(chart))
    };
  });
}

export async function getDashboardSummary(actor: SessionUser): Promise<DashboardSummaryDto> {
  const dashboard = await getDashboard(actor, "office");
  const now = new Date().toISOString();

  return {
    upcomingHearings: [],
    overdueTasks: [],
    recentActivity: dashboard.recentActivity.map((item) => ({
      id: item.id,
      action: item.title,
      entityType: item.subtitle,
      entityId: null,
      createdAt: item.createdAt ?? now
    }))
  };
}
