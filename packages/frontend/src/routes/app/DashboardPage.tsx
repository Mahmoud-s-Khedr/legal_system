import { useQuery } from "@tanstack/react-query";
import type { DashboardSummaryDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { apiFetch } from "../../lib/api";
import { EmptyState, PageHeader, SectionCard, StatCard, formatDateTime } from "./ui";
import { StatCardSkeleton, SectionCardSkeleton } from "../../components/shared/Skeleton";
import { useAuthBootstrap } from "../../store/authStore";

function getGreetingKey(): "night" | "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

export function DashboardPage() {
  const { t } = useTranslation("app");
  const { user } = useAuthBootstrap();
  const summaryQuery = useQuery({
    queryKey: ["dashboard-summary"],
    queryFn: () => apiFetch<DashboardSummaryDto>("/api/dashboard/summary")
  });

  const summary = summaryQuery.data;
  const isLoading = summaryQuery.isLoading;
  const greeting = t(`greeting.${getGreetingKey()}`);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={user?.fullName ? `${greeting}، ${user.fullName}` : greeting}
        description={t("dashboard.description")}
      />

      {/* ── Stat cards ── */}
      <div className="grid gap-4 md:grid-cols-3">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard label={t("dashboard.cards.hearings")} value={summary?.upcomingHearings.length ?? 0} />
            <StatCard label={t("dashboard.cards.tasks")} value={summary?.overdueTasks.length ?? 0} />
            <StatCard label={t("dashboard.cards.activity")} value={summary?.recentActivity.length ?? 0} />
          </>
        )}
      </div>

      {/* ── Detail sections ── */}
      {isLoading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCardSkeleton />
          <SectionCardSkeleton />
          <SectionCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard title={t("dashboard.sections.upcomingHearings")} description={t("dashboard.sections.upcomingHearingsHelp")}>
            {!summary?.upcomingHearings.length ? (
              <EmptyState title={t("empty.noHearings")} description={t("empty.noHearingsHelp")} />
            ) : (
              <div className="space-y-3">
                {summary.upcomingHearings.map((hearing) => (
                  <article className="rounded-2xl border border-slate-200 p-4 transition hover:border-accent" key={hearing.id}>
                    <p className="font-semibold">{hearing.caseTitle}</p>
                    <p className="mt-1 text-sm text-slate-600">{formatDateTime(hearing.sessionDatetime)}</p>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title={t("dashboard.sections.overdueTasks")} description={t("dashboard.sections.overdueTasksHelp")}>
            {!summary?.overdueTasks.length ? (
              <EmptyState title={t("empty.noTasks")} description={t("empty.noTasksHelp")} />
            ) : (
              <div className="space-y-3">
                {summary.overdueTasks.map((task) => (
                  <article className="rounded-2xl border border-slate-200 p-4 transition hover:border-accent" key={task.id}>
                    <p className="font-semibold">{task.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{task.caseTitle ?? t("labels.generalTask")}</p>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard title={t("dashboard.sections.activity")} description={t("dashboard.sections.activityHelp")}>
            {!summary?.recentActivity.length ? (
              <EmptyState title={t("empty.noActivity")} description={t("empty.noActivityHelp")} />
            ) : (
              <div className="space-y-3">
                {summary.recentActivity.map((item) => (
                  <article className="rounded-2xl border border-slate-200 p-4 transition hover:border-accent" key={item.id}>
                    <p className="font-semibold">{item.action}</p>
                    <p className="mt-1 text-sm text-slate-600">
                      {item.entityType} · {formatDateTime(item.createdAt)}
                    </p>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}

