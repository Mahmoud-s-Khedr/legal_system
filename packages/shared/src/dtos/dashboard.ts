import type { HearingDto } from "./hearings";
import type { TaskDto } from "./tasks";

export type DashboardScope = "my" | "team" | "office";
export type DashboardRange = "30d" | "90d";

export interface AuditFeedItemDto {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  createdAt: string;
}

export interface DashboardSummaryDto {
  upcomingHearings: HearingDto[];
  overdueTasks: TaskDto[];
  recentActivity: AuditFeedItemDto[];
}

export type DashboardWidgetKey =
  | "priority_strip"
  | "my_work"
  | "recent_activity"
  | "admin_kpis"
  | "lawyer_deadlines"
  | "finance_review"
  | "assistant_intake"
  | "analytics";

export interface DashboardWidgetDto {
  key: DashboardWidgetKey;
  title: string;
  description?: string;
}

export interface DashboardPriorityCardDto {
  key: "dueToday" | "overdue" | "hearings7d" | "unassigned";
  label: string;
  value: number;
  href?: string;
}

export type DashboardWorkItemType = "task" | "hearing";

export interface DashboardWorkItemDto {
  id: string;
  type: DashboardWorkItemType;
  title: string;
  subtitle: string;
  dueAt: string | null;
  href: string;
  priority: "low" | "medium" | "high" | "urgent";
}

export interface DashboardActivityItemDto {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
}

export interface DashboardResponseDto {
  scope: DashboardScope;
  roleLabel: string;
  widgets: DashboardWidgetDto[];
  priorityCards: DashboardPriorityCardDto[];
  upcomingTasks: DashboardWorkItemDto[];
  upcomingSessions: DashboardWorkItemDto[];
  recentActivity: DashboardActivityItemDto[];
}

export type DashboardChartKind =
  | "casesTrend"
  | "tasksTrend"
  | "hearingsTrend"
  | "riskBuckets"
  | "financeTrend"
  | "caseAgingBuckets"
  | "overdueTrajectory"
  | "dsoCollectionLag"
  | "invoiceVoidTrend";

export interface DashboardChartSeriesDto {
  key: string;
}

export interface DashboardChartPointDto {
  label: string;
  values: Record<string, number>;
}

export interface DashboardChartDto {
  key: DashboardChartKind;
  title: string;
  description?: string;
  series: DashboardChartSeriesDto[];
  points: DashboardChartPointDto[];
  redacted: boolean;
  emptyReason?: "no_data" | "suppressed";
  valueFormat?: "number" | "currency" | "days";
}

export interface DashboardAnalyticsResponseDto {
  scope: DashboardScope;
  range: DashboardRange;
  charts: DashboardChartDto[];
}
