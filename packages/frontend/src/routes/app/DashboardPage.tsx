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
  localizeChartDescription,
  localizeChartTitle,
  localizeDashboardChartLabel,
  localizeDashboardSeriesLabel,
  localizePriorityCardLabel,
  localizeRangeLabel,
  localizeScopeLabel
} from "../../lib/dashboardI18n";
import {
  EmptyState,
  ErrorState,
  PageHeader,
  SectionCard,
  StatCard,
  formatCurrency,
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
  return chart.key === "financeTrend";
}

function seriesColor(seriesKey: string, index: number) {
  const palette: Record<string, string> = {
    count: "#0f766e",
    completed: "#0f766e",
    overdue: "#dc2626",
    revenue: "#0f766e",
    profit: "#2563eb",
    expenses: "#f59e0b",
    avgCollectionDays: "#2563eb",
    paidInvoices: "#14b8a6",
    voidCount: "#ea580c",
    voidAmount: "#991b1b"
  };

  return palette[seriesKey] ?? ["#0f766e", "#2563eb", "#f59e0b", "#dc2626"][index % 4];
}

function formatChartMetric(chart: DashboardChartDto, value: number) {
  if (chart.valueFormat === "currency") {
    return formatCurrency(value);
  }

  return String(value);
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
  const charts = useMemo(() => analytics?.charts ?? [], [analytics?.charts]);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={t("dashboard.eyebrow")}
        title={user?.fullName ? `${greeting}، ${user.fullName}` : greeting}
        description={t("dashboard.analytics.pageDescription")}
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
        title={t("dashboard.analytics.title")}
        description={t("dashboard.analytics.description")}
      >
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {t("dashboard.analytics.badges.scope")}: {localizeScopeLabel(t, scope)}
          </span>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
            {t("dashboard.analytics.badges.window")}: {localizeRangeLabel(t, range)}
          </span>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            aria-label={t("dashboard.analytics.aria.scope")}
            value={scope}
            onChange={(event) => setScope(event.target.value as DashboardScope)}
          >
            <option value="my">{localizeScopeLabel(t, "my")}</option>
            <option value="team">{localizeScopeLabel(t, "team")}</option>
            <option value="office">{localizeScopeLabel(t, "office")}</option>
          </select>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm"
            aria-label={t("dashboard.analytics.aria.range")}
            value={range}
            onChange={(event) => setRange(event.target.value as DashboardRange)}
          >
            <option value="30d">{localizeRangeLabel(t, "30d")}</option>
            <option value="90d">{localizeRangeLabel(t, "90d")}</option>
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
          <EmptyState
            title={t("dashboard.analytics.states.noAnalytics.title")}
            description={t("dashboard.analytics.states.noAnalytics.description")}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {charts.map((chart) => (
              <section className="rounded-2xl border border-slate-200 bg-white p-4" key={chart.key}>
                <h3 className="font-heading text-base">{localizeChartTitle(t, chart.key)}</h3>
                <p className="text-sm text-slate-600">
                  {localizeChartDescription(t, chart.key)}
                </p>

                {chart.redacted ? (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-700">
                    {chart.points.length === 0
                      ? t("dashboard.analytics.states.suppressed.insufficientVolume")
                      : t("dashboard.analytics.states.suppressed.partial")}
                  </p>
                ) : null}

                {chart.points.length === 0 ? (
                  <div className="mt-3">
                    <EmptyState
                      title={chart.emptyReason === "suppressed"
                        ? t("dashboard.analytics.states.suppressed.title")
                        : t("dashboard.analytics.states.noData.title")}
                      description={chart.emptyReason === "suppressed"
                        ? t("dashboard.analytics.states.suppressed.description")
                        : t("dashboard.analytics.states.noData.description")}
                    />
                  </div>
                ) : (
                  <>
                    <div className="mt-3 h-64 min-h-[16rem]">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartIsLine(chart) ? (
                          <LineChart data={chart.points} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" tickFormatter={(label) => localizeDashboardChartLabel(t, chart.key, String(label))} />
                            <YAxis
                              allowDecimals={chart.valueFormat !== "currency"}
                              tickFormatter={(value) => formatChartMetric(chart, Number(value))}
                            />
                            <Tooltip
                              formatter={(value, name) => [
                                formatChartMetric(chart, Number(value)),
                                String(name)
                              ]}
                              labelFormatter={(label) => localizeDashboardChartLabel(t, chart.key, String(label))}
                            />
                            <Legend />
                            {chart.series.map((series, index) => (
                              <Line
                                key={`${chart.key}-${series.key}`}
                                type="monotone"
                                dataKey={`values.${series.key}`}
                                name={localizeDashboardSeriesLabel(t, chart.key, series.key)}
                                stroke={seriesColor(series.key, index)}
                                strokeWidth={2}
                              />
                            ))}
                          </LineChart>
                        ) : (
                          <BarChart data={chart.points} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="label" tickFormatter={(label) => localizeDashboardChartLabel(t, chart.key, String(label))} />
                            <YAxis
                              allowDecimals={chart.valueFormat !== "currency"}
                              tickFormatter={(value) => formatChartMetric(chart, Number(value))}
                            />
                            <Tooltip
                              formatter={(value, name) => [
                                formatChartMetric(chart, Number(value)),
                                String(name)
                              ]}
                              labelFormatter={(label) => localizeDashboardChartLabel(t, chart.key, String(label))}
                            />
                            <Legend />
                            {chart.series.map((series, index) => (
                              <Bar
                                key={`${chart.key}-${series.key}`}
                                dataKey={`values.${series.key}`}
                                name={localizeDashboardSeriesLabel(t, chart.key, series.key)}
                                fill={seriesColor(series.key, index)}
                              />
                            ))}
                          </BarChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="text-slate-500">
                            <th className="py-1 text-start">{t("dashboard.analytics.table.label")}</th>
                            {chart.series.map((series) => (
                              <th className="py-1 text-end" key={`${chart.key}-${series.key}`}>
                                {localizeDashboardSeriesLabel(t, chart.key, series.key)}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {chart.points.map((point) => (
                            <tr key={`${chart.key}-${point.label}`}>
                              <td className="py-1 text-slate-700">{localizeDashboardChartLabel(t, chart.key, point.label)}</td>
                              {chart.series.map((series) => (
                                <td className="py-1 text-end font-semibold text-slate-900" key={`${chart.key}-${point.label}-${series.key}`}>
                                  {formatChartMetric(chart, point.values[series.key] ?? 0)}
                                </td>
                              ))}
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
            <Link
              className="block transition hover:-translate-y-0.5"
              key={card.key}
              to={card.href ?? "/app/dashboard"}
            >
              <StatCard label={localizePriorityCardLabel(t, card.key)} value={card.value} />
            </Link>
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
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCardSkeleton />
          <SectionCardSkeleton />
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <SectionCard title={t("dashboard.analytics.sections.upcomingTasks.title")} description={t("dashboard.analytics.sections.upcomingTasks.description")}>
            {!summary?.upcomingTasks.length ? (
              <EmptyState title={t("dashboard.analytics.sections.upcomingTasks.emptyTitle")} description={t("dashboard.analytics.sections.upcomingTasks.emptyDescription")} />
            ) : (
              <div className="space-y-3">
                {summary.upcomingTasks.map((item) => (
                  <Link key={`${item.type}-${item.id}`} to={item.href}>
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
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title={t("dashboard.analytics.sections.upcomingSessions.title")} description={t("dashboard.analytics.sections.upcomingSessions.description")}>
            {!summary?.upcomingSessions.length ? (
              <EmptyState title={t("dashboard.analytics.sections.upcomingSessions.emptyTitle")} description={t("dashboard.analytics.sections.upcomingSessions.emptyDescription")} />
            ) : (
              <div className="space-y-3">
                {summary.upcomingSessions.map((item) => (
                  <Link key={`${item.type}-${item.id}`} to={item.href}>
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
                  </Link>
                ))}
              </div>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  );
}
