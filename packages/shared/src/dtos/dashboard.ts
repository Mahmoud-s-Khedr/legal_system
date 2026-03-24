import type { HearingDto } from "./hearings";
import type { TaskDto } from "./tasks";

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
