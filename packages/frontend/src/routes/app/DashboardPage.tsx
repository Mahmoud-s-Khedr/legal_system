import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
  DashboardAnalyticsResponseDto,
  DashboardChartDto,
  DashboardRange,
  DashboardResponseDto,
  DashboardScope
} from "@elms/shared";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { apiFetch } from "../../lib/api";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  StatCard,
  formatDateTime
} from "./ui";
import { StatCardSkeleton, SectionCardSkeleton } from "../../components/shared/Skeleton";
import { useAuthBootstrap } from "../../store/authStore";

function getGreetingKey(): "night" | "morning" | "afternoon" | "evening" {
  const hour = new Date().getHours();
  if (hour < 6) return "night";
  if (hour < 12) return "morning";
  if (hour < 18) return "afternoon";
  return "evening";
}

function chartIsLine(chart: DashboardChartDto) {
  return chart.key === "casesTrend" || chart.key === "hearingsTrend" || chart.key === "financeTrend";
}

function normalizeChartLabel(input: string) {
  return input
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function DashboardPage() {
  const { t } = useTranslation("app");
  const { user } = useAuthBootstrap();
  const [scope, setScope] = useState<DashboardScope>("my");
  const [range, setRange] = useState<DashboardRange>("30d");

  const summaryQuery = useQuery({
    queryKey: ["dashboard", scope],
    queryFn: () => apiFetch<DashboardResponseDto>(`/api/dashboard?scope=${scope}`)
  });

  const analyticsQuery = useQuery({
    queryKey: ["dashboard-analytics", scope, range],
    queryFn: () =>
      apiFetch<DashboardAnalyticsResponseDto>(
        `/api/dashboard/analytics?scope=${scope}&range=${range}`
      )
  });

  const summary = summaryQuery.data;
  const analytics = analyticsQuery.data;
  const greeting = t(`greeting.${getGreetingKey()}`);
  const charts = useMemo(() => (analytics?.charts ?? []).slice(0, 4), [analytics?.charts]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={user?.fullName ? `${greeting}، ${user.fullName}` : greeting}
        description="Action-first dashboard with permission-scoped workload and analytics."
        actions={(
          <div className="flex flex-wrap items-center gap-2">
            <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              {summary?.roleLabel ?? "Role"}
            </div>
            <Link className="rounded-2xl border border-accent px-3 py-2 text-sm font-semibold text-accent hover:bg-accent/5" to="/app/cases/quick-new">
              {t("actions.quickIntake")}
            </Link>
            <Link className="rounded-2xl bg-accent px-3 py-2 text-sm font-semibold text-white" to="/app/tasks/new">
              {t("actions.newTask")}
            </Link>
          </div>
        )}
      />

      <SectionCard
        title="Analytics"
        description="Permission-safe trends based on your current scope and timeframe."
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Scope: {scope.toUpperCase()}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            Window: {range}
          </span>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            aria-label="Dashboard scope"
            value={scope}
            onChange={(event) => setScope(event.target.value as DashboardScope)}
          >
            <option value="my">My</option>
            <option value="team">Team</option>
            <option value="office">Office</option>
          </select>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            aria-label="Dashboard timeframe"
            value={range}
            onChange={(event) => setRange(event.target.value as DashboardRange)}
          >
            <option value="30d">30 days</option>
            <option value="90d">90 days</option>
          </select>
        </div>

        {analyticsQuery.isError ? (
          <ErrorState
            title={t("errors.title")}
            description={(analyticsQuery.error as Error)?.message ?? t("errors.fallback")}
            retryLabel={t("errors.reload")}
            onRetry={() => void analyticsQuery.refetch()}
          />
        ) : analyticsQuery.isLoading ? (
          <div className="grid gap-4 md:grid-cols-2">
            <SectionCardSkeleton />
            <SectionCardSkeleton />
          </div>
        ) : charts.length === 0 ? (
          <EmptyState title="No analytics available" description="No chart data is permitted in this scope." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {charts.map((chart) => (
              <section className="rounded-2xl border border-slate-200 bg-white p-4" key={chart.key}>
                <h3 className="font-heading text-base">{chart.title}</h3>
                {chart.description ? <p className="text-sm text-slate-600">{chart.description}</p> : null}

                {chart.redacted ? (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                    {chart.points.length === 0
                      ? "Insufficient volume after privacy threshold (k>=3)."
                      : "Some low-volume buckets were suppressed for privacy."}
                  </p>
                ) : null}

                {chart.points.length === 0 ? (
                  <div className="mt-3">
                    <EmptyState
                      title={chart.emptyReason === "suppressed" ? "Privacy threshold applied" : "No data for this chart"}
                      description={chart.emptyReason === "suppressed"
                        ? "Try Office scope or 90-day range to increase sample size."
                        : "No records available for the selected filters."}
                    />
                  </div>
                ) : (
                  <>
                    <div className="mt-3 h-64 min-h-[16rem]">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartIsLine(chart) ? (
                          <LineChart data={chart.points} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" tickFormatter={normalizeChartLabel} />
                            <YAxis allowDecimals={false} />
                            <Tooltip
                              formatter={(value) => [value, "Count"]}
                              labelFormatter={(label) => normalizeChartLabel(String(label))}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="value" name="Count" stroke="#0f766e" strokeWidth={2} />
                          </LineChart>
                        ) : (
                          <BarChart data={chart.points} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" tickFormatter={normalizeChartLabel} />
                            <YAxis allowDecimals={false} />
                            <Tooltip
                              formatter={(value) => [value, "Count"]}
                              labelFormatter={(label) => normalizeChartLabel(String(label))}
                            />
                            <Legend />
                            <Bar dataKey="value" name="Count" fill="#0f766e" />
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-slate-500">
                            <th className="py-1 text-start">Label</th>
                            <th className="py-1 text-end">Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chart.points.map((point) => (
                            <tr key={`${chart.key}-${point.label}`}>
                              <td className="py-1 text-slate-700">{normalizeChartLabel(point.label)}</td>
                              <td className="py-1 text-end font-semibold text-slate-900">{point.value}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </section>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid gap-4 md:grid-cols-4">
        {summaryQuery.isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          (summary?.priorityCards ?? []).map((card) => (
            <a key={card.key} href={card.href ?? "/app/dashboard"}>
              <StatCard label={card.label} value={card.value} />
            </a>
          ))
        )}
      </div>

      {summaryQuery.isError ? (
        <ErrorState
          title={t("errors.title")}
          description={(summaryQuery.error as Error)?.message ?? t("errors.fallback")}
          retryLabel={t("errors.reload")}
          onRetry={() => void summaryQuery.refetch()}
        />
      ) : summaryQuery.isLoading ? (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCardSkeleton />
          <SectionCardSkeleton />
          <SectionCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-3">
          <SectionCard title="My work queue" description="Tasks and hearings that need immediate follow-up.">
            {!summary?.myWork.length ? (
              <EmptyState title="No urgent work" description="You're clear for now." />
            ) : (
              <div className="space-y-3">
                {summary.myWork.map((item) => (
                  <a key={`${item.type}-${item.id}`} href={item.href}>
                    <article className="rounded-2xl border border-slate-200 p-4 transition hover:border-accent">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold">{item.title}</p>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold uppercase text-slate-600">
                          {item.priority}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
                      {item.dueAt ? (
                        <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.dueAt)}</p>
                      ) : null}
                    </article>
                  </a>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Recent safe activity" description="Events scoped to your current visibility.">
            {!summary?.recentActivity.length ? (
              <EmptyState title="No activity" description="No recent updates in this scope." />
            ) : (
              <div className="space-y-3">
                {summary.recentActivity.map((item) => (
                  <article className="rounded-2xl border border-slate-200 p-4" key={item.id}>
                    <p className="font-semibold">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.subtitle}</p>
                    <p className="mt-1 text-xs text-slate-500">{formatDateTime(item.createdAt)}</p>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Enabled widgets" description="Server-authorized widgets for your role.">
            {!summary?.widgets.length ? (
              <EmptyState title="No widgets" description="No widgets are currently allowed for this scope." />
            ) : (
              <div className="space-y-3">
                {summary.widgets.map((widget) => (
                  <article className="rounded-2xl border border-slate-200 p-4" key={widget.key}>
                    <p className="font-semibold">{widget.title}</p>
                    {widget.description ? <p className="mt-1 text-sm text-slate-600">{widget.description}</p> : null}
                    <p className="mt-1 text-xs text-slate-500">Key: {widget.key}</p>
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
