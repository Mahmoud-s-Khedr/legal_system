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
import { Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { inTenantTransaction } from "../../repositories/unitOfWork.js";
import { listRecentAuditActivity } from "../../repositories/dashboard/dashboard.repository.js";
import {
  queryDsoCollectionLagReport,
  queryInvoiceVoidTrendReport
} from "../../repositories/reports/reports.repository.js";
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

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function buildDaySeries(startDate: Date, endDate: Date): string[] {
  const days: string[] = [];
  const cursor = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  while (cursor.getTime() <= end.getTime()) {
    days.push(isoDay(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
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

    const priorityCards: DashboardResponseDto["priorityCards"] = [
      { key: "dueToday", label: "Due today", value: dueToday, href: "/app/tasks" },
      { key: "overdue", label: "Overdue", value: overdue, href: "/app/tasks?overdue=true" },
      { key: "hearings7d", label: "Hearings in 7 days", value: hearings7d, href: "/app/hearings" },
      { key: "unassigned", label: "Unassigned", value: unassigned, href: "/app/tasks" }
    ];

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
      const now = new Date();
      const days = buildDaySeries(startDate, now);
      const doneRows = await tx.task.findMany({
        where: {
          ...taskWhere,
          status: TaskStatus.DONE,
          updatedAt: { gte: startDate, lte: now }
        },
        select: { updatedAt: true }
      });
      const overdueRows = await tx.task.findMany({
        where: {
          ...taskWhere,
          dueAt: { gte: startDate, lt: now },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
        },
        select: { dueAt: true }
      });
      const doneByDay = new Map<string, number>();
      for (const row of doneRows) {
        const key = isoDay(row.updatedAt);
        doneByDay.set(key, (doneByDay.get(key) ?? 0) + 1);
      }
      const overdueByDay = new Map<string, number>();
      for (const row of overdueRows) {
        if (!row.dueAt) continue;
        const key = isoDay(row.dueAt);
        overdueByDay.set(key, (overdueByDay.get(key) ?? 0) + 1);
      }
      const points = days.map((day) => ({
        label: day,
        value: doneByDay.get(day) ?? 0,
        secondaryValue: overdueByDay.get(day) ?? 0
      }));
      const redaction = redactSmallGroups(points.map((point) => ({ label: point.label, value: point.value })));
      chartByKey.set("tasksTrend", finalizeChart({
        key: "tasksTrend",
        title: "Tasks completed vs overdue",
        points: points.filter((point) => redaction.points.some((allowed) => allowed.label === point.label)),
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
        title: "Invoice status mix",
        points: redaction.points,
        redacted: redaction.redacted
      }));
    }

    if (rules.some((r) => r.key === "caseAgingBuckets")) {
      const now = new Date();
      const rows = await tx.case.findMany({
        where: {
          firmId: actor.firmId,
          deletedAt: null,
          status: { not: "CLOSED" },
          ...(scope !== "office" && scopeContext.caseIds ? { id: { in: scopeContext.caseIds } } : {})
        },
        select: { createdAt: true }
      });
      const buckets = { "0_30": 0, "31_60": 0, "61_90": 0, "90_PLUS": 0 };
      for (const row of rows) {
        const age = Math.floor((now.getTime() - row.createdAt.getTime()) / 86_400_000);
        if (age <= 30) buckets["0_30"] += 1;
        else if (age <= 60) buckets["31_60"] += 1;
        else if (age <= 90) buckets["61_90"] += 1;
        else buckets["90_PLUS"] += 1;
      }
      const points = [
        { label: "0_30", value: buckets["0_30"] },
        { label: "31_60", value: buckets["31_60"] },
        { label: "61_90", value: buckets["61_90"] },
        { label: "90_PLUS", value: buckets["90_PLUS"] }
      ];
      const redaction = redactSmallGroups(points);
      chartByKey.set("caseAgingBuckets", finalizeChart({
        key: "caseAgingBuckets",
        title: "Case aging buckets",
        points: redaction.points,
        redacted: redaction.redacted
      }));
    }

    if (rules.some((r) => r.key === "overdueTrajectory")) {
      const now = new Date();
      const days = buildDaySeries(startDate, now);
      const overdueRows = await tx.task.findMany({
        where: {
          ...taskWhere,
          dueAt: { gte: startDate, lt: now },
          status: { notIn: [TaskStatus.DONE, TaskStatus.CANCELLED] }
        },
        select: { dueAt: true }
      });
      const dueByDay = new Map<string, number>();
      for (const row of overdueRows) {
        if (!row.dueAt) continue;
        const key = isoDay(row.dueAt);
        dueByDay.set(key, (dueByDay.get(key) ?? 0) + 1);
      }
      const points = days.map((day) => ({ label: day, value: dueByDay.get(day) ?? 0 }));
      const redaction = redactSmallGroups(points);
      chartByKey.set("overdueTrajectory", finalizeChart({
        key: "overdueTrajectory",
        title: "Overdue trajectory",
        points: redaction.points,
        redacted: redaction.redacted
      }));
    }

    if (rules.some((r) => r.key === "dsoCollectionLag")) {
      const rows = await queryDsoCollectionLagReport(
        tx,
        actor.firmId,
        { dateFrom: startDate.toISOString() },
        { caseIds: scope === "office" ? null : scopeContext.caseIds }
      );
      const points = rows.map((row) => ({
        label: row.month,
        value: Math.round(Number(row.avgCollectionDays)),
        secondaryValue: Number(row.paidInvoices)
      }));
      chartByKey.set("dsoCollectionLag", finalizeChart({
        key: "dsoCollectionLag",
        title: "DSO collection lag",
        points,
        redacted: false
      }));
    }

    if (rules.some((r) => r.key === "invoiceVoidTrend")) {
      const rows = await queryInvoiceVoidTrendReport(
        tx,
        actor.firmId,
        { dateFrom: startDate.toISOString() },
        { caseIds: scope === "office" ? null : scopeContext.caseIds }
      );
      const points = rows.map((row) => ({
        label: row.month,
        value: Number(row.voidCount),
        secondaryValue: Math.round(Number(row.voidAmount))
      }));
      chartByKey.set("invoiceVoidTrend", finalizeChart({
        key: "invoiceVoidTrend",
        title: "Invoice void trend",
        points,
        redacted: false
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
