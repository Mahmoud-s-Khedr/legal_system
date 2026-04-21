import { useQuery } from "@tanstack/react-query";
import type { DashboardSummaryDto } from "@elms/shared";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { apiFetch } from "../../lib/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  StatCard,
  formatDateTime
} from "./ui";
import {
  StatCardSkeleton,
  SectionCardSkeleton
} from "../../components/shared/Skeleton";
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
  const isError = summaryQuery.isError;
  const greeting = t(`greeting.${getGreetingKey()}`);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={user?.fullName ? `${greeting}، ${user.fullName}` : greeting}
        description={t("dashboard.description")}
      />

      {/* ── Quick-add bar ── */}
      <div className="flex flex-wrap gap-3">
        <Link
          className="rounded-2xl border border-accent px-4 py-2 text-sm font-semibold text-accent hover:bg-accent/5"
          to="/app/cases/quick-new"
        >
          {t("actions.quickIntake")}
        </Link>
        <Link
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          to="/app/cases/new"
        >
          {t("actions.newCase")}
        </Link>
        <Link
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          to="/app/hearings/new"
        >
          {t("actions.newHearing")}
        </Link>
        <Link
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          to="/app/tasks/new"
        >
          {t("actions.newTask")}
        </Link>
        <Link
          className="rounded-2xl bg-accent px-4 py-2 text-sm font-semibold text-white"
          to="/app/invoices/new"
        >
          {t("actions.newInvoice")}
        </Link>
      </div>

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
            <Link to="/app/hearings">
              <StatCard
                label={t("dashboard.cards.hearings")}
                value={summary?.upcomingHearings.length ?? 0}
              />
            </Link>
            <Link to="/app/tasks">
              <StatCard
                label={t("dashboard.cards.tasks")}
                value={summary?.overdueTasks.length ?? 0}
              />
            </Link>
            <StatCard
              label={t("dashboard.cards.activity")}
              value={summary?.recentActivity.length ?? 0}
            />
          </>
        )}
      </div>

      {/* ── Detail sections ── */}
      {isError ? (
        <ErrorState
          title={t("errors.title")}
          description={
            (summaryQuery.error as Error)?.message ?? t("errors.fallback")
          }
          retryLabel={t("errors.reload")}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : isLoading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCardSkeleton />
          <SectionCardSkeleton />
          <SectionCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard
            title={t("dashboard.sections.upcomingHearings")}
            description={t("dashboard.sections.upcomingHearingsHelp")}
          >
            {!summary?.upcomingHearings.length ? (
              <EmptyState
                title={t("empty.noHearings")}
                description={t("empty.noHearingsHelp")}
              />
            ) : (
              <div className="space-y-3">
                {summary.upcomingHearings.map((hearing) => (
                  <Link
                    key={hearing.id}
                    params={{ caseId: hearing.caseId }}
                    to="/app/cases/$caseId"
                  >
                    <article className="rounded-2xl border border-slate-200 p-4 transition hover:border-accent">
                      <p className="font-semibold">{hearing.caseTitle}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {formatDateTime(hearing.sessionDatetime)}
                      </p>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard
            title={t("dashboard.sections.overdueTasks")}
            description={t("dashboard.sections.overdueTasksHelp")}
          >
            {!summary?.overdueTasks.length ? (
              <EmptyState
                title={t("empty.noTasks")}
                description={t("empty.noTasksHelp")}
              />
            ) : (
              <div className="space-y-3">
                {summary.overdueTasks.map((task) => (
                  <Link
                    key={task.id}
                    params={{ taskId: task.id }}
                    to="/app/tasks/$taskId"
                  >
                    <article className="rounded-2xl border border-slate-200 p-4 transition hover:border-accent">
                      <p className="font-semibold">{task.title}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        {task.caseTitle ?? t("labels.generalTask")}
                      </p>
                    </article>
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
          <SectionCard
            title={t("dashboard.sections.activity")}
            description={t("dashboard.sections.activityHelp")}
          >
            {!summary?.recentActivity.length ? (
              <EmptyState
                title={t("empty.noActivity")}
                description={t("empty.noActivityHelp")}
              />
            ) : (
              <div className="space-y-3">
                {summary.recentActivity.map((item) => (
                  <article
                    className="rounded-2xl border border-slate-200 p-4 transition hover:border-accent"
                    key={item.id}
                  >
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
