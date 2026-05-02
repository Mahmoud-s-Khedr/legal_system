import type {
  DashboardActivityItemDto,
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
import { CaseStatus, Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import { listRecentAuditActivity } from "../../repositories/dashboard/dashboard.repository.js";
import { resolveDashboardChartRules, resolveDashboardWidgets } from "./dashboard.registry.js";

const K_ANONYMITY_MIN = 3;

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

function formatAction(action: string) {
  return action.replace(/\./g, " ");
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

function redactActivityTitle(action: string) {
  return action.includes("invoice") ? "finance update" : formatAction(action);
}

export async function getDashboard(actor: SessionUser, scope: DashboardScope): Promise<DashboardResponseDto> {
  return inTenantTransaction(actor.firmId, async (tx) => {
    const scopeContext = await resolveScopeContext(tx, actor, scope);
    const taskWhere = buildTaskWhere(actor, scope, scopeContext);
    const hearingWhere = buildHearingWhere(actor, scope, scopeContext);
    const now = new Date();
    const weekAhead = new Date(now);
    weekAhead.setDate(now.getDate() + 7);

    const [dueToday, overdue, hearings7d, unassigned, myTasks, myHearings, activities] = await Promise.all([
      tx.task.count({
        where: {
          ...taskWhere,
          dueAt: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()), lt: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) },
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
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
        },
        include: {
          case: { select: { id: true, title: true } }
        },
        orderBy: [{ dueAt: "asc" }, { updatedAt: "desc" }],
        take: 6
      }),
      tx.caseSession.findMany({
        where: {
          ...hearingWhere,
          sessionDatetime: { gte: now }
        },
        include: { case: { select: { id: true, title: true } } },
        orderBy: { sessionDatetime: "asc" },
        take: 4
      }),
      listRecentAuditActivity(tx, actor.firmId, {
        limit: 10,
        userIds: scopeContext.userIds ?? undefined
      })
    ]);

    const priorityCards = [
      { key: "dueToday", label: "Due today", value: dueToday, href: "/app/tasks" },
      { key: "overdue", label: "Overdue", value: overdue, href: "/app/tasks?overdue=true" },
      { key: "hearings7d", label: "Hearings in 7 days", value: hearings7d, href: "/app/hearings" },
      { key: "unassigned", label: "Unassigned", value: unassigned, href: "/app/tasks" }
    ] as DashboardResponseDto["priorityCards"];

    const taskItems: DashboardWorkItemDto[] = myTasks.map((task) => ({
      id: task.id,
      type: "task",
      title: task.title,
      subtitle: task.case?.title ?? "General task",
      dueAt: task.dueAt?.toISOString() ?? null,
      href: `/app/tasks/${task.id}`,
      priority: task.priority.toLowerCase() as DashboardWorkItemDto["priority"]
    }));

    const hearingItems: DashboardWorkItemDto[] = myHearings.map((hearing) => ({
      id: hearing.id,
      type: "hearing",
      title: hearing.case.title,
      subtitle: "Hearing",
      dueAt: hearing.sessionDatetime.toISOString(),
      href: `/app/cases/${hearing.case.id}`,
      priority: "high"
    }));

    const activityItems: DashboardActivityItemDto[] = activities.map((item) => {
      const isFinanceActivity = item.action.startsWith("invoices") || item.action.startsWith("expenses");
      const canSeeFinance = actor.permissions.includes("invoices:read") || actor.permissions.includes("expenses:read");
      return {
        id: item.id,
        title: isFinanceActivity && !canSeeFinance ? "Finance activity" : redactActivityTitle(item.action),
        subtitle: isFinanceActivity && !canSeeFinance ? "Restricted details" : item.entityType,
        createdAt: item.createdAt.toISOString()
      };
    });

    return {
      scope,
      roleLabel: titleCaseRole(actor.roleKey),
      widgets: resolveDashboardWidgets(actor, scope),
      priorityCards,
      myWork: [...taskItems, ...hearingItems]
        .sort((a, b) => {
          if (!a.dueAt && !b.dueAt) return 0;
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          return a.dueAt.localeCompare(b.dueAt);
        })
        .slice(0, 8),
      recentActivity: activityItems
    };
  });
}

function redactSmallGroups(points: DashboardChartPointDto[]): { redacted: boolean; points: DashboardChartPointDto[] } {
  if (points.length === 0) {
    return { redacted: false, points };
  }

  if (points.some((point) => point.value < K_ANONYMITY_MIN)) {
    return {
      redacted: true,
      points: points.filter((point) => point.value >= K_ANONYMITY_MIN)
    };
  }

  return { redacted: false, points };
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
    const startDate = startDateForRange(range);
    const taskWhere = buildTaskWhere(actor, scope, scopeContext);
    const hearingWhere = buildHearingWhere(actor, scope, scopeContext);

    const chartByKey = new Map<string, DashboardChartDto>();

    if (rules.some((r) => r.key === "casesTrend")) {
      const caseWhere: Prisma.CaseWhereInput = {
        firmId: actor.firmId,
        deletedAt: null,
        createdAt: { gte: startDate },
        ...(scope !== "office" && scopeContext.caseIds ? { id: { in: scopeContext.caseIds } } : {})
      };
      const opened = await tx.case.groupBy({
        by: ["status"],
        where: caseWhere,
        _count: { _all: true }
      });
      const points = opened.map((row) => ({ label: row.status, value: row._count._all }));
      const redaction = redactSmallGroups(points);
      chartByKey.set("casesTrend", finalizeChart({
        key: "casesTrend",
        title: "Cases opened vs closed",
        description: "Status distribution in selected range",
        points: redaction.points,
        redacted: redaction.redacted
      }));
    }

    if (rules.some((r) => r.key === "tasksTrend")) {
      const taskRows = await tx.task.groupBy({
        by: ["status"],
        where: {
          ...taskWhere,
          createdAt: { gte: startDate }
        },
        _count: { _all: true }
      });
      const points = taskRows.map((row) => ({ label: row.status, value: row._count._all }));
      const redaction = redactSmallGroups(points);
      chartByKey.set("tasksTrend", finalizeChart({
        key: "tasksTrend",
        title: "Tasks completed vs overdue",
        points: redaction.points,
        redacted: redaction.redacted
      }));
    }

    if (rules.some((r) => r.key === "hearingsTrend")) {
      const hearingRows = await tx.caseSession.groupBy({
        by: ["outcome"],
        where: {
          ...hearingWhere,
          sessionDatetime: { gte: startDate }
        },
        _count: { _all: true }
      });
      const points = hearingRows.map((row) => ({ label: row.outcome ?? "Scheduled", value: row._count._all }));
      const redaction = redactSmallGroups(points);
      chartByKey.set("hearingsTrend", finalizeChart({
        key: "hearingsTrend",
        title: "Hearings scheduled",
        points: redaction.points,
        redacted: redaction.redacted
      }));
    }

    if (rules.some((r) => r.key === "pipeline")) {
      const pipelineRows = await tx.case.groupBy({
        by: ["status"],
        where: {
          firmId: actor.firmId,
          deletedAt: null,
          ...(scope !== "office" && scopeContext.caseIds ? { id: { in: scopeContext.caseIds } } : {})
        },
        _count: { _all: true }
      });
      const points = pipelineRows
        .filter(
          (row) =>
            row.status === CaseStatus.ACTIVE ||
            row.status === CaseStatus.SUSPENDED ||
            row.status === CaseStatus.CLOSED
        )
        .map((row) => ({ label: row.status, value: row._count._all }));
      const redaction = redactSmallGroups(points);
      chartByKey.set("pipeline", finalizeChart({
        key: "pipeline",
        title: "Pipeline",
        points: redaction.points,
        redacted: redaction.redacted
      }));
    }

    if (rules.some((r) => r.key === "riskBuckets")) {
      const now = new Date();
      const [overdueHigh, upcomingUrgent] = await Promise.all([
        tx.task.count({
          where: {
            ...taskWhere,
            dueAt: { lt: now },
            priority: { in: [TaskPriority.HIGH, TaskPriority.URGENT] },
            status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
          }
        }),
        tx.caseSession.count({
          where: {
            ...hearingWhere,
            sessionDatetime: { gte: now, lte: new Date(now.getTime() + 3 * 86_400_000) }
          }
        })
      ]);

      const points = [
        { label: "Overdue high-priority tasks", value: overdueHigh },
        { label: "Hearings in 72h", value: upcomingUrgent }
      ];
      const redaction = redactSmallGroups(points);
      chartByKey.set("riskBuckets", finalizeChart({
        key: "riskBuckets",
        title: "Risk buckets",
        points: redaction.points,
        redacted: redaction.redacted
      }));
    }

    if (rules.some((r) => r.key === "financeTrend")) {
      const invoiceRows = await tx.invoice.groupBy({
        by: ["status"],
        where: {
          firmId: actor.firmId,
          createdAt: { gte: startDate },
          ...(scope !== "office" && scopeContext.caseIds ? { caseId: { in: scopeContext.caseIds } } : {})
        },
        _count: { _all: true }
      });

      const points = invoiceRows.map((row) => ({ label: row.status, value: row._count._all }));
      const redaction = redactSmallGroups(points);
      chartByKey.set("financeTrend", finalizeChart({
        key: "financeTrend",
        title: "Collections trend",
        points: redaction.points,
        redacted: redaction.redacted
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
